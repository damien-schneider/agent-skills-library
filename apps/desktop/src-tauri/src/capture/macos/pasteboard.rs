use std::thread;
use std::time::{Duration, Instant};

use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, KeyCode};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use objc2::rc::{autoreleasepool, Retained};
use objc2::runtime::ProtocolObject;
use objc2_app_kit::{NSPasteboard, NSPasteboardItem, NSPasteboardTypeString, NSPasteboardWriting};
use objc2_foundation::{NSArray, NSData, NSString};

use super::SelectionCaptureError;

const CLIPBOARD_POLL_INTERVAL: Duration = Duration::from_millis(10);
const CLIPBOARD_TIMEOUT: Duration = Duration::from_millis(350);
const CLIPBOARD_SETTLE_DELAY: Duration = Duration::from_millis(30);

pub(super) fn selected_text_from_clipboard() -> Result<String, SelectionCaptureError> {
    autoreleasepool(|_| {
        let pasteboard = NSPasteboard::generalPasteboard();
        let snapshot = PasteboardSnapshot::read(&pasteboard)?;
        let initial_change_count = pasteboard.changeCount();
        synthesize_copy()?;
        let string_type = unsafe { NSPasteboardTypeString };

        let deadline = Instant::now() + CLIPBOARD_TIMEOUT;
        let mut copied_change_count = None;
        let mut copied_text = None;
        let mut last_change_at = None;
        while Instant::now() < deadline {
            let now = Instant::now();
            let change_count = pasteboard.changeCount();
            if is_first_copy_change(initial_change_count, copied_change_count, change_count)? {
                copied_change_count = Some(change_count);
                last_change_at = Some(now);
                copied_text = pasteboard
                    .stringForType(string_type)
                    .map(|value| value.to_string());
            }
            if copied_text.is_some()
                && last_change_at.is_some_and(|changed_at| {
                    now.duration_since(changed_at) >= CLIPBOARD_SETTLE_DELAY
                })
            {
                break;
            }
            thread::sleep(CLIPBOARD_POLL_INTERVAL);
        }

        if let Some(change_count) = copied_change_count {
            snapshot.restore_if_unchanged(&pasteboard, change_count)?;
        }

        copied_text.ok_or(SelectionCaptureError::NoSelection(
            "the source app did not copy selected text",
        ))
    })
}

fn is_first_copy_change(
    initial_change_count: isize,
    copied_change_count: Option<isize>,
    change_count: isize,
) -> Result<bool, SelectionCaptureError> {
    if change_count == initial_change_count {
        return Ok(false);
    }
    match copied_change_count {
        None => Ok(true),
        Some(copied) if copied == change_count => Ok(false),
        Some(_) => Err(SelectionCaptureError::ClipboardChanged),
    }
}

fn synthesize_copy() -> Result<(), SelectionCaptureError> {
    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState).map_err(|_| {
        SelectionCaptureError::ClipboardUnavailable(
            "could not create keyboard event source".to_string(),
        )
    })?;
    let key_down =
        CGEvent::new_keyboard_event(source.clone(), KeyCode::ANSI_C, true).map_err(|_| {
            SelectionCaptureError::ClipboardUnavailable(
                "could not create copy key-down event".to_string(),
            )
        })?;
    let key_up = CGEvent::new_keyboard_event(source, KeyCode::ANSI_C, false).map_err(|_| {
        SelectionCaptureError::ClipboardUnavailable(
            "could not create copy key-up event".to_string(),
        )
    })?;
    key_down.set_flags(CGEventFlags::CGEventFlagCommand);
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);
    key_down.post(CGEventTapLocation::HID);
    key_up.post(CGEventTapLocation::HID);
    Ok(())
}

#[derive(Debug)]
struct PasteboardSnapshot {
    items: Vec<Vec<PasteboardRepresentation>>,
}

impl PasteboardSnapshot {
    fn read(pasteboard: &NSPasteboard) -> Result<Self, SelectionCaptureError> {
        let Some(pasteboard_items) = pasteboard.pasteboardItems() else {
            return Ok(Self { items: Vec::new() });
        };

        let mut items = Vec::with_capacity(pasteboard_items.len());
        for item in pasteboard_items.to_vec() {
            let item_types = item.types();
            let mut representations = Vec::with_capacity(item_types.len());
            for data_type in item_types.to_vec() {
                let data = item.dataForType(&data_type).ok_or_else(|| {
                    SelectionCaptureError::ClipboardUnavailable(format!(
                        "could not snapshot clipboard representation {}",
                        data_type
                    ))
                })?;
                representations.push(PasteboardRepresentation {
                    data_type: data_type.to_string(),
                    data: data.to_vec(),
                });
            }
            items.push(representations);
        }
        Ok(Self { items })
    }

    fn restore_if_unchanged(
        self,
        pasteboard: &NSPasteboard,
        expected_change_count: isize,
    ) -> Result<(), SelectionCaptureError> {
        let mut objects: Vec<Retained<ProtocolObject<dyn NSPasteboardWriting>>> =
            Vec::with_capacity(self.items.len());
        for representations in self.items {
            let item = NSPasteboardItem::new();
            for representation in representations {
                let data_type = NSString::from_str(&representation.data_type);
                let data = NSData::with_bytes(&representation.data);
                if !item.setData_forType(&data, &data_type) {
                    return Err(SelectionCaptureError::ClipboardUnavailable(format!(
                        "could not restore clipboard representation {}",
                        representation.data_type
                    )));
                }
            }
            objects.push(ProtocolObject::from_retained(item));
        }

        if pasteboard.changeCount() != expected_change_count {
            return Err(SelectionCaptureError::ClipboardChanged);
        }
        pasteboard.clearContents();

        if !objects.is_empty() {
            let items = NSArray::from_retained_slice(&objects);
            if !pasteboard.writeObjects(&items) {
                return Err(SelectionCaptureError::ClipboardUnavailable(
                    "could not restore clipboard contents".to_string(),
                ));
            }
        }
        Ok(())
    }
}

#[derive(Debug)]
struct PasteboardRepresentation {
    data_type: String,
    data: Vec<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restores_the_original_clipboard_after_temporary_copy() {
        autoreleasepool(|_| {
            let pasteboard = NSPasteboard::pasteboardWithUniqueName();
            let string_type = unsafe { NSPasteboardTypeString };
            pasteboard.clearContents();
            assert!(pasteboard
                .setString_forType(&NSString::from_str("original clipboard"), string_type));
            let snapshot = PasteboardSnapshot::read(&pasteboard).unwrap();

            pasteboard.clearContents();
            assert!(pasteboard
                .setString_forType(&NSString::from_str("temporary selection"), string_type));
            snapshot
                .restore_if_unchanged(&pasteboard, pasteboard.changeCount())
                .unwrap();

            assert_eq!(
                pasteboard
                    .stringForType(string_type)
                    .map(|value| value.to_string()),
                Some("original clipboard".to_string())
            );
        });
    }

    #[test]
    fn preserves_a_competing_clipboard_write() {
        autoreleasepool(|_| {
            let pasteboard = NSPasteboard::pasteboardWithUniqueName();
            let string_type = unsafe { NSPasteboardTypeString };
            pasteboard.clearContents();
            assert!(pasteboard
                .setString_forType(&NSString::from_str("original clipboard"), string_type));
            let snapshot = PasteboardSnapshot::read(&pasteboard).unwrap();

            pasteboard.clearContents();
            assert!(pasteboard
                .setString_forType(&NSString::from_str("temporary selection"), string_type));
            let copied_change_count = pasteboard.changeCount();
            pasteboard.clearContents();
            assert!(
                pasteboard.setString_forType(&NSString::from_str("competing write"), string_type)
            );

            assert!(matches!(
                snapshot.restore_if_unchanged(&pasteboard, copied_change_count),
                Err(SelectionCaptureError::ClipboardChanged)
            ));
            assert_eq!(
                pasteboard
                    .stringForType(string_type)
                    .map(|value| value.to_string()),
                Some("competing write".to_string())
            );
        });
    }

    #[test]
    fn rejects_a_second_clipboard_change_before_restore() {
        assert!(is_first_copy_change(10, None, 11).unwrap());
        assert!(!is_first_copy_change(10, Some(11), 11).unwrap());
        assert!(matches!(
            is_first_copy_change(10, Some(11), 12),
            Err(SelectionCaptureError::ClipboardChanged)
        ));
    }
}

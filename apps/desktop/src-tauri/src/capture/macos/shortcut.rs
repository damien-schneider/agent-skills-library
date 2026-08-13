use std::cell::RefCell;
use std::sync::mpsc::SyncSender;
use std::time::{Duration, Instant};

use core_foundation::runloop::CFRunLoop;
use core_graphics::event::{
    CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement,
    CGEventType, CallbackResult, EventField, KeyCode,
};

const DOUBLE_SHIFT_INTERVAL: Duration = Duration::from_millis(500);

pub(super) fn listen_for_double_shift(sender: SyncSender<()>) -> Result<(), ()> {
    let detector = RefCell::new(DoubleShiftDetector::new(DOUBLE_SHIFT_INTERVAL));
    CGEventTap::with_enabled(
        CGEventTapLocation::Session,
        CGEventTapPlacement::HeadInsertEventTap,
        CGEventTapOptions::ListenOnly,
        vec![CGEventType::FlagsChanged, CGEventType::KeyDown],
        move |_proxy, event_type, event| {
            let mut detector = detector.borrow_mut();
            match event_type {
                CGEventType::FlagsChanged => {
                    let key_code =
                        event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as u16;
                    if is_shift_key(key_code) {
                        let is_down = event.get_flags().contains(CGEventFlags::CGEventFlagShift);
                        if detector.update_shift(is_down, Instant::now()) {
                            let _ = sender.try_send(());
                        }
                    } else {
                        detector.cancel();
                    }
                }
                CGEventType::KeyDown => detector.cancel(),
                _ => {}
            }
            CallbackResult::Keep
        },
        CFRunLoop::run_current,
    )
}

fn is_shift_key(key_code: u16) -> bool {
    matches!(key_code, KeyCode::SHIFT | KeyCode::RIGHT_SHIFT)
}

#[derive(Debug)]
struct DoubleShiftDetector {
    interval: Duration,
    last_release: Option<Instant>,
    current_press_started_at: Option<Instant>,
    current_press_valid: bool,
}

impl DoubleShiftDetector {
    fn new(interval: Duration) -> Self {
        Self {
            interval,
            last_release: None,
            current_press_started_at: None,
            current_press_valid: false,
        }
    }

    fn update_shift(&mut self, is_down: bool, now: Instant) -> bool {
        if is_down {
            if self.current_press_started_at.is_some() {
                self.current_press_valid = false;
            } else {
                self.current_press_started_at = Some(now);
                self.current_press_valid = true;
            }
            return false;
        }

        let Some(started_at) = self.current_press_started_at.take() else {
            return false;
        };
        if !std::mem::take(&mut self.current_press_valid)
            || now.duration_since(started_at) > self.interval
        {
            self.last_release = None;
            return false;
        }

        let is_double_tap = self
            .last_release
            .is_some_and(|last| now.duration_since(last) <= self.interval);
        self.last_release = if is_double_tap { None } else { Some(now) };
        is_double_tap
    }

    fn cancel(&mut self) {
        self.last_release = None;
        self.current_press_started_at = None;
        self.current_press_valid = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_two_complete_shift_taps_inside_the_interval() {
        let start = Instant::now();
        let mut detector = DoubleShiftDetector::new(Duration::from_millis(500));

        assert!(!detector.update_shift(true, start));
        assert!(!detector.update_shift(false, start + Duration::from_millis(20)));
        assert!(!detector.update_shift(true, start + Duration::from_millis(200)));
        assert!(detector.update_shift(false, start + Duration::from_millis(220)));
    }

    #[test]
    fn ignores_slow_or_interrupted_shift_taps() {
        let start = Instant::now();
        let mut detector = DoubleShiftDetector::new(Duration::from_millis(500));

        detector.update_shift(true, start);
        detector.update_shift(false, start + Duration::from_millis(20));
        detector.update_shift(true, start + Duration::from_millis(600));
        assert!(!detector.update_shift(false, start + Duration::from_millis(620)));

        detector.update_shift(true, start + Duration::from_millis(700));
        detector.cancel();
        assert!(!detector.update_shift(false, start + Duration::from_millis(720)));
        detector.update_shift(true, start + Duration::from_millis(800));
        assert!(!detector.update_shift(false, start + Duration::from_millis(820)));
    }

    #[test]
    fn ignores_held_shift_presses() {
        let start = Instant::now();
        let mut detector = DoubleShiftDetector::new(Duration::from_millis(500));

        detector.update_shift(true, start);
        assert!(!detector.update_shift(false, start + Duration::from_secs(2)));
        detector.update_shift(true, start + Duration::from_millis(2100));
        assert!(!detector.update_shift(false, start + Duration::from_millis(2120)));
    }

    #[test]
    fn ignores_overlapping_shift_keys() {
        let start = Instant::now();
        let mut detector = DoubleShiftDetector::new(Duration::from_millis(500));

        detector.update_shift(true, start);
        detector.update_shift(true, start + Duration::from_millis(10));
        detector.update_shift(true, start + Duration::from_millis(20));
        assert!(!detector.update_shift(false, start + Duration::from_millis(30)));
        detector.update_shift(true, start + Duration::from_millis(100));
        assert!(!detector.update_shift(false, start + Duration::from_millis(120)));
    }
}

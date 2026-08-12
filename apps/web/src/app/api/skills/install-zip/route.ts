import { slugifySkillName } from "@skills-agent-library/skills-core/install-targets";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { fetchBundleFiles } from "@/features/skills/install/install-bundle";

interface InstallZipRequest {
  skillName: string;
  skillContent: string;
  sourceUrl?: string;
  includeBundle?: boolean;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as InstallZipRequest;
    const { skillName, skillContent, sourceUrl, includeBundle } = body;

    if (!(skillName && skillContent)) {
      return NextResponse.json(
        { error: "skillName and skillContent are required" },
        { status: 400 }
      );
    }

    const safeSkillName = slugifySkillName(skillName);
    const zip = new JSZip();
    const skillFolder = zip.folder(safeSkillName);

    if (!skillFolder) {
      return NextResponse.json(
        { error: "Failed to create ZIP folder" },
        { status: 500 }
      );
    }

    if (includeBundle && sourceUrl) {
      const bundleFiles = await fetchBundleFiles(sourceUrl);

      for (const [filePath, content] of bundleFiles) {
        skillFolder.file(filePath, content);
      }
    } else {
      skillFolder.file("SKILL.md", skillContent);
    }

    const zipBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeSkillName}.zip"`,
        "Content-Length": zipBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

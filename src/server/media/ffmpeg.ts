import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export type AudioOutputFormat = "mp3" | "wav";

/**
 * Convert a video file into an audio file.
 *
 * Supported formats:
 * - mp3
 * - wav
 *
 * The source video is preserved.
 * The generated audio is written to the supplied output path.
 */
export async function videoToAudio(
  input: string,
  output: string,
  format: AudioOutputFormat = "mp3"
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error(
      "FFmpeg binary was not found. Ensure ffmpeg-static is installed correctly."
    );
  }

  if (!input || !input.trim()) {
    throw new Error("FFmpeg input path is required.");
  }

  if (!output || !output.trim()) {
    throw new Error("FFmpeg output path is required.");
  }

  const args: string[] = [
    "-y",
    "-i",
    input,
    "-vn",
  ];

  if (format === "mp3") {
    args.push(
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k"
    );
  } else {
    args.push(
      "-codec:a",
      "pcm_s16le"
    );
  }

  args.push(output);

  await new Promise<void>((resolve, reject) => {
    const process = spawn(
      ffmpegPath,
      args,
      {
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    );

    let stderr = "";

    process.stderr.on(
      "data",
      (chunk: Buffer) => {
        stderr += chunk.toString();
      }
    );

    process.on(
      "error",
      (error) => {
        reject(
          new Error(
            `Unable to start FFmpeg: ${error.message}`
          )
        );
      }
    );

    process.on(
      "close",
      (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `FFmpeg failed with code ${code}: ${stderr.slice(-4000)}`
          )
        );
      }
    );
  });
}


/**
 * Convert video to MP3 audio.
 */
export async function videoToMp3(
  input: string,
  output: string
): Promise<void> {
  return videoToAudio(
    input,
    output,
    "mp3"
  );
}


/**
 * Convert video to WAV audio.
 */
export async function videoToWav(
  input: string,
  output: string
): Promise<void> {
  return videoToAudio(
    input,
    output,
    "wav"
  );
}

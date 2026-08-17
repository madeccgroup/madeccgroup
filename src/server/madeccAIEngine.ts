import {
  GoogleGenAI,
} from "@google/genai";

import fs from "node:fs/promises";
import path from "node:path";

import {
  uploadMADECCAIStream,
} from "./madeccAICloudinary";

const apiKey =
  process.env.GEMINI_API_KEY;

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
    })
  : null;

const TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL ||
  "gemini-3.6-flash";

const VISION_MODEL =
  process.env.GEMINI_VISION_MODEL ||
  "gemini-3.6-flash";

const TTS_MODEL =
  process.env.GEMINI_TTS_MODEL ||
  "gemini-3.1-flash-tts-preview";

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ||
  "gemini-3.1-flash-image";

const VIDEO_MODEL =
  process.env.GEMINI_VIDEO_MODEL ||
  "gemini-omni-flash-preview";

const SYSTEM_INSTRUCTION = `
You are MADECC AI Studio.

You are the multimodal AI assistant for MADECC Group,
a construction and engineering company operating in Cameroon
and Central Africa.

Your capabilities include:

- Construction
- Civil engineering
- Quantity surveying
- BOQ preparation
- Quantity take-off
- Cost estimation
- Project management
- Procurement
- Technical reports
- Marketing
- Business documents
- Image analysis
- Drawing analysis
- Audio transcription
- Video analysis
- Translation
- Text generation
- Media creation

Professional requirements:

1. Never invent measured quantities.
2. Never invent project prices.
3. Clearly identify assumptions.
4. Clearly distinguish AI estimates from verified information.
5. Do not claim engineering certification.
6. Safety-critical engineering decisions must be verified
   by a qualified professional.
7. Use SI units unless the user specifies otherwise.
8. Use XAF for Cameroon cost contexts.
9. Support English and French.
10. Protect confidential project and client information.
11. Produce professional business-quality outputs.
`;

function ensureAI() {
  if (!ai) {
    const error =
      new Error(
        "GEMINI_API_KEY is not configured."
      );

    (error as any).code =
      "GEMINI_NOT_CONFIGURED";

    throw error;
  }

  return ai;
}

export async function generateText(
  prompt: string,
  options?: {
    systemInstruction?: string;
    previousInteractionId?: string;
  }
) {
  const client =
    ensureAI();

  const interaction =
    await client.interactions.create(
      {
        model: TEXT_MODEL,

        system_instruction:
          options?.systemInstruction ||
          SYSTEM_INSTRUCTION,

        input: prompt,

        previous_interaction_id:
          options?.previousInteractionId,
      }
    );

  return {
    text:
      interaction.output_text ||
      "",
    interactionId:
      interaction.id,
    model:
      TEXT_MODEL,
  };
}

export async function generateImage(
  prompt: string,
  options?: {
    aspectRatio?:
      | "1:1"
      | "16:9"
      | "9:16"
      | "4:3"
      | "3:4";
    imageSize?:
      | "1K"
      | "2K"
      | "4K";
  }
) {
  const client =
    ensureAI();

  const interaction =
    await client.interactions.create(
      {
        model: IMAGE_MODEL,

        system_instruction:
          SYSTEM_INSTRUCTION,

        input: prompt,

        response_format: {
          type: "image",
          mime_type:
            "image/png",
          aspect_ratio:
            options?.aspectRatio ||
            "16:9",
          image_size:
            options?.imageSize ||
            "2K",
        },
      }
    );

  const image =
    interaction.output_image;

  if (!image?.data) {
    throw new Error(
      "Gemini did not return an image."
    );
  }

  const buffer =
    Buffer.from(
      image.data,
      "base64"
    );

  const uploaded =
    await uploadMADECCAIStream(
      buffer,
      {
        type: "image",
        format: "png",
      }
    );

  return {
    ...uploaded,
    model:
      IMAGE_MODEL,
    interactionId:
      interaction.id,
  };
}

export async function generateSpeech(
  text: string,
  options?: {
    voice?: string;
    language?: string;
  }
) {
  const client =
    ensureAI();

  const language =
    options?.language ||
    "English";

  const voice =
    options?.voice ||
    "Kore";

  const prompt = `
Read the following MADECC Group script
professionally.

Language:
${language}

Voice:
${voice}

Style:
Professional corporate construction company narration.
Clear diction.
Natural pacing.
Confident but trustworthy.
Suitable for website, advertisement, training or social media.

SCRIPT:

${text}
`;

  const interaction =
    await client.interactions.create(
      {
        model: TTS_MODEL,

        system_instruction:
          SYSTEM_INSTRUCTION,

        input: prompt,

        response_format: {
          type: "audio",
        },

        generation_config: {
          speech_config: [
            {
              voice,
            },
          ],
        },
      }
    );

  const audio =
    interaction.output_audio;

  if (!audio?.data) {
    throw new Error(
      "Gemini did not return audio."
    );
  }

  const buffer =
    Buffer.from(
      audio.data,
      "base64"
    );

  const uploaded =
    await uploadMADECCAIStream(
      buffer,
      {
        type: "video",
        format: "wav",
      }
    );

  return {
    ...uploaded,
    model:
      TTS_MODEL,
    interactionId:
      interaction.id,
  };
}

export async function generateVideo(
  prompt: string,
  options?: {
    aspectRatio?:
      | "16:9"
      | "9:16";
  }
) {
  const client =
    ensureAI();

  const interaction =
    await client.interactions.create(
      {
        model: VIDEO_MODEL,

        system_instruction:
          SYSTEM_INSTRUCTION,

        input: prompt,

        response_format: {
          type: "video",
          aspect_ratio:
            options?.aspectRatio ||
            "16:9",
        },
      }
    );

  const video =
    interaction.output_video;

  if (!video?.data) {
    throw new Error(
      "Gemini did not return a video."
    );
  }

  const buffer =
    Buffer.from(
      video.data,
      "base64"
    );

  const uploaded =
    await uploadMADECCAIStream(
      buffer,
      {
        type: "video",
        format: "mp4",
      }
    );

  return {
    ...uploaded,
    model:
      VIDEO_MODEL,
    interactionId:
      interaction.id,
  };
}

export async function uploadGeminiFile(
  filePath: string,
  mimeType: string
) {
  const client =
    ensureAI();

  const file =
    await client.files.upload(
      {
        file: filePath,

        config: {
          mimeType,
        },
      }
    );

  return file;
}

export async function analyzeFile(
  filePath: string,
  mimeType: string,
  prompt: string
) {
  const client =
    ensureAI();

  const uploaded =
    await uploadGeminiFile(
      filePath,
      mimeType
    );

  const category =
    mimeType.startsWith(
      "video/"
    )
      ? "video"
      : mimeType.startsWith(
          "audio/"
        )
      ? "audio"
      : mimeType ===
          "application/pdf"
      ? "document"
      : mimeType.startsWith(
          "image/"
        )
      ? "image"
      : "document";

  const interaction =
    await client.interactions.create(
      {
        model:
          VISION_MODEL,

        system_instruction:
          SYSTEM_INSTRUCTION,

        input: [
          {
            type: category,
            uri: uploaded.uri,
            mime_type:
              uploaded.mimeType ||
              mimeType,
          },

          {
            type: "text",
            text: prompt,
          },
        ],
      }
    );

  return {
    text:
      interaction.output_text ||
      "",
    model:
      VISION_MODEL,
    interactionId:
      interaction.id,
    geminiFile:
      uploaded.uri,
  };
}

export async function transcribeAudio(
  filePath: string,
  mimeType: string,
  language = "auto"
) {
  return analyzeFile(
    filePath,
    mimeType,
    `
Transcribe this audio completely.

Requirements:

1. Produce an accurate transcript.
2. Identify different speakers where possible.
3. Include timestamps where possible.
4. Identify the language.
5. If language is not English, provide English translation.
6. Produce a concise summary.
7. Extract decisions.
8. Extract action items.
9. Extract deadlines.
10. Extract names and responsibilities.

Requested language:
${language}
`
  );
}

export async function analyzeVideo(
  filePath: string,
  mimeType: string
) {
  return analyzeFile(
    filePath,
    mimeType,
    `
Analyze this construction/business video.

Return:

1. Transcript.
2. Executive summary.
3. Important timestamps.
4. Construction activities observed.
5. Materials observed.
6. Equipment observed.
7. Personnel/actions observed.
8. Potential quality issues.
9. Potential safety observations.
10. Project management observations.
11. Recommended follow-up actions.
12. Draft professional report.

Do not invent observations that are not supported
by the video.
`
  );
}

export async function analyzeImage(
  filePath: string,
  mimeType: string,
  prompt?: string
) {
  return analyzeFile(
    filePath,
    mimeType,
    prompt ||
      `
Analyze this image professionally.

If it is a construction image:
- Identify visible construction elements.
- Identify materials.
- Identify equipment.
- Identify workmanship observations.
- Identify potential quality concerns.
- Identify possible safety concerns.
- Provide a professional site observation.

If it is an architectural or engineering drawing:
- Identify visible spaces.
- Identify dimensions where readable.
- Identify walls.
- Identify doors.
- Identify windows.
- Identify structural elements where visible.
- Identify schedules/annotations.
- Explain what is confidently detected.
- Explicitly identify information that cannot be reliably read.

Do not invent dimensions or quantities.
`
  );
}

export async function analyzeDocument(
  filePath: string,
  mimeType: string
) {
  return analyzeFile(
    filePath,
    mimeType,
    `
Analyze this document for MADECC Group.

Return:

- Document title
- Executive summary
- Important facts
- Parties
- Dates
- Financial information
- Project information
- Scope
- Obligations
- Risks
- Missing information
- Action items
- Important clauses
- Recommended next steps

Do not invent information.
`
  );
}

export async function translateText(
  text: string,
  targetLanguage: string
) {
  return generateText(
    `
Translate the following MADECC Group content into:

${targetLanguage}

Requirements:

- Preserve meaning.
- Preserve technical construction terminology.
- Preserve numbers.
- Preserve units.
- Preserve names.
- Use natural professional language.

CONTENT:

${text}
`
  );
}

export async function generateBOQFromDrawing(
  filePath: string,
  mimeType: string
) {
  const client =
    ensureAI();

  const uploaded =
    await uploadGeminiFile(
      filePath,
      mimeType
    );

  const schema = {
    type: "object",
    properties: {
      projectSummary: {
        type: "string",
      },

      confidence: {
        type: "number",
      },

      assumptions: {
        type: "array",
        items: {
          type: "string",
        },
      },

      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            item: {
              type: "string",
            },
            description: {
              type: "string",
            },
            unit: {
              type: "string",
            },
            quantity: {
              type: "number",
            },
            basis: {
              type: "string",
            },
            confidence: {
              type: "number",
            },
          },

          required: [
            "item",
            "description",
            "unit",
            "quantity",
            "basis",
            "confidence",
          ],
        },
      },
    },

    required: [
      "projectSummary",
      "confidence",
      "assumptions",
      "items",
    ],
  };

  const interaction =
    await client.interactions.create(
      {
        model:
          VISION_MODEL,

        system_instruction:
          SYSTEM_INSTRUCTION,

        input: [
          {
            type:
              mimeType ===
              "application/pdf"
                ? "document"
                : "image",

            uri: uploaded.uri,

            mime_type:
              uploaded.mimeType ||
              mimeType,
          },

          {
            type: "text",

            text: `
Analyze this construction drawing
for preliminary quantity take-off.

Return ONLY data supported by
the drawing.

Do not invent dimensions.

If something cannot be read,
state that it cannot be reliably
measured.

The output is a preliminary AI
quantity take-off and MUST be
professionally verified before
being used as a contractual BOQ.
`,
          },
        ],

        response_format: {
          type: "text",
          mime_type:
            "application/json",
          schema,
        },
      }
    );

  return {
    data: JSON.parse(
      interaction.output_text ||
        "{}"
    ),

    model:
      VISION_MODEL,

    interactionId:
      interaction.id,
  };
}
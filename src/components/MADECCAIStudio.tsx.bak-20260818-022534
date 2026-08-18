import React, {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type StudioTab =
  | "chat"
  | "video"
  | "audio"
  | "media"
  | "documents"
  | "drawings"
  | "transcribe"
  | "global";

type MediaResult = {
  id?: string;
  url?: string;
  text?: string;
  transcript?: string;
  analysis?: string;
  boq?: unknown;
  mediaId?: string;
  jobId?: string;
};

const tabs: {
  id: StudioTab;
  label: string;
  icon: string;
}[] = [
  {
    id: "chat",
    label: "AI Chat",
    icon: "✦",
  },
  {
    id: "video",
    label: "Video",
    icon: "🎬",
  },
  {
    id: "audio",
    label: "Audio",
    icon: "🔊",
  },
  {
    id: "media",
    label: "Media",
    icon: "🖼",
  },
  {
    id: "documents",
    label: "Documents",
    icon: "📄",
  },
  {
    id: "drawings",
    label: "Drawings → BOQ",
    icon: "🏗",
  },
  {
    id: "transcribe",
    label: "Transcribe",
    icon: "🎙",
  },
  {
    id: "global",
    label: "Global",
    icon: "🌍",
  },
];

const quickPrompts = [
  "Create a professional 60-second advertisement for MADECC Group quantity surveying services in Cameroon.",
  "Prepare a professional construction project proposal.",
  "Analyze this construction project from a quantity surveying perspective.",
  "Create a professional BOQ structure for a G+1 residential building.",
  "Write a French version of our construction company profile.",
];

export default function MADECCAIStudio() {
  const [tab, setTab] =
    useState<StudioTab>("chat");

  const [prompt, setPrompt] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState<MediaResult | null>(
      null
    );

  const [projectId, setProjectId] =
    useState("");

  const [language, setLanguage] =
    useState("English");

  const [targetLanguage, setTargetLanguage] =
    useState("French");

  const [voice, setVoice] =
    useState("Kore");

  const [aspectRatio, setAspectRatio] =
    useState<
      "16:9" | "9:16"
    >("16:9");

  const fileRef =
    useRef<HTMLInputElement>(null);

  const [mediaLibrary, setMediaLibrary] =
    useState<any[]>([]);

  useEffect(() => {
    loadMedia();
  }, []);

  async function loadMedia() {
    try {
      const response =
        await fetch(
          "/api/ai/media",
          {
            credentials:
              "include",
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.media
      ) {
        setMediaLibrary(
          data.media
        );
      }
    } catch {
      // Keep UI usable.
    }
  }

  async function callJSON(
    url: string,
    body: unknown
  ) {
    const response =
      await fetch(url, {
        method: "POST",
        credentials:
          "include",
        headers: {
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(body),
      });

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message ||
          "MADECC AI request failed."
      );
    }

    return data;
  }

  async function runText() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data =
        await callJSON(
          "/api/ai/text",
          {
            prompt,
            projectId:
              projectId ||
              undefined,
          }
        );

      setResult(data);
      await loadMedia();
    } catch (err: any) {
      setError(
        err.message ||
          "Text generation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runChat() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data =
        await callJSON(
          "/api/ai/chat",
          {
            message:
              prompt,
            projectId:
              projectId ||
              undefined,
          }
        );

      setResult({
        text:
          data.message,
      });
    } catch (err: any) {
      setError(
        err.message ||
          "AI chat failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runImage() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data =
        await callJSON(
          "/api/ai/image",
          {
            prompt,
            projectId:
              projectId ||
              undefined,
            aspectRatio,
            imageSize:
              "2K",
          }
        );

      setResult(data);
      await loadMedia();
    } catch (err: any) {
      setError(
        err.message ||
          "Image generation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runSpeech() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data =
        await callJSON(
          "/api/ai/speech",
          {
            text:
              prompt,
            projectId:
              projectId ||
              undefined,
            language,
            voice,
          }
        );

      setResult(data);
      await loadMedia();
    } catch (err: any) {
      setError(
        err.message ||
          "Speech generation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runVideo() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data =
        await callJSON(
          "/api/ai/video",
          {
            prompt,
            projectId:
              projectId ||
              undefined,
            aspectRatio,
          }
        );

      setResult(data);
      await loadMedia();
    } catch (err: any) {
      setError(
        err.message ||
          "Video generation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runTranslation() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data =
        await callJSON(
          "/api/ai/translate",
          {
            text:
              prompt,
            targetLanguage,
          }
        );

      setResult({
        text:
          data.translation,
      });
    } catch (err: any) {
      setError(
        err.message ||
          "Translation failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadAndAnalyze(
    endpoint: string,
    file: File
  ) {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const form =
        new FormData();

      form.append(
        "file",
        file
      );

      if (projectId) {
        form.append(
          "projectId",
          projectId
        );
      }

      if (prompt.trim()) {
        form.append(
          "prompt",
          prompt
        );
      }

      const response =
        await fetch(
          endpoint,
          {
            method:
              "POST",
            credentials:
              "include",
            body: form,
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Media processing failed."
        );
      }

      setResult(data);
      await loadMedia();
    } catch (err: any) {
      setError(
        err.message ||
          "Media processing failed."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      tab ===
      "transcribe"
    ) {
      void uploadAndAnalyze(
        "/api/ai/transcribe",
        file
      );
    }

    if (
      tab ===
      "video"
    ) {
      void uploadAndAnalyze(
        "/api/ai/video/analyze",
        file
      );
    }

    if (
      tab ===
      "media"
    ) {
      void uploadAndAnalyze(
        "/api/ai/image/analyze",
        file
      );
    }

    if (
      tab ===
      "documents"
    ) {
      void uploadAndAnalyze(
        "/api/ai/document/analyze",
        file
      );
    }

    if (
      tab ===
      "drawings"
    ) {
      void uploadAndAnalyze(
        "/api/ai/drawing/analyze",
        file
      );
    }

    event.target.value =
      "";
  }

  function downloadText(
    text: string,
    filename =
      "madecc-ai-output.txt"
  ) {
    const blob =
      new Blob(
        [text],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    anchor.download =
      filename;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  }

  const currentTab =
    tabs.find(
      (item) =>
        item.id === tab
    );

  return (
    <div
      style={{
        minHeight:
          "100vh",
        background:
          "#f5f7fb",
        color:
          "#172033",
        display:
          "flex",
        flexDirection:
          "column",
      }}
    >
      <style>{`
        .madecc-ai-top {
          background:#fff;
          border-bottom:1px solid #e3e7ee;
          padding:20px 24px;
        }

        .madecc-ai-title {
          font-size:25px;
          font-weight:800;
        }

        .madecc-ai-subtitle {
          color:#718096;
          margin-top:5px;
        }

        .madecc-ai-tabs {
          display:flex;
          gap:8px;
          overflow-x:auto;
          padding:12px 24px;
          background:#fff;
          border-bottom:1px solid #e3e7ee;
        }

        .madecc-ai-tab {
          white-space:nowrap;
          border:1px solid #dce2ea;
          background:#fff;
          border-radius:10px;
          padding:10px 14px;
          cursor:pointer;
          font-weight:700;
        }

        .madecc-ai-tab.active {
          background:#111827;
          color:#fff;
          border-color:#111827;
        }

        .madecc-ai-workspace {
          width:min(1200px,calc(100% - 32px));
          margin:25px auto;
          display:grid;
          grid-template-columns:1fr 320px;
          gap:20px;
        }

        .madecc-ai-card {
          background:#fff;
          border:1px solid #e2e7ef;
          border-radius:16px;
          padding:20px;
          box-shadow:0 5px 20px rgba(15,23,42,.04);
        }

        .madecc-ai-card h2 {
          margin-top:0;
        }

        .madecc-ai-textarea {
          width:100%;
          min-height:180px;
          resize:vertical;
          border:1px solid #d8dee8;
          border-radius:12px;
          padding:14px;
          box-sizing:border-box;
          font-family:inherit;
          font-size:15px;
          outline:none;
        }

        .madecc-ai-button {
          border:0;
          border-radius:10px;
          padding:11px 16px;
          background:#111827;
          color:#fff;
          font-weight:700;
          cursor:pointer;
        }

        .madecc-ai-button.secondary {
          background:#eef2f7;
          color:#172033;
        }

        .madecc-ai-button:disabled {
          opacity:.5;
          cursor:not-allowed;
        }

        .madecc-ai-actions {
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:12px;
        }

        .madecc-ai-select {
          width:100%;
          border:1px solid #d8dee8;
          border-radius:9px;
          padding:10px;
          background:#fff;
          margin-bottom:12px;
        }

        .madecc-ai-result {
          margin-top:20px;
          border-top:1px solid #e7ebf1;
          padding-top:20px;
        }

        .madecc-ai-result-text {
          white-space:pre-wrap;
          line-height:1.7;
          background:#f8fafc;
          border-radius:10px;
          padding:15px;
        }

        .madecc-ai-media {
          width:100%;
          max-height:600px;
          object-fit:contain;
          border-radius:12px;
          background:#111;
        }

        .madecc-ai-error {
          margin-top:15px;
          padding:12px;
          border-radius:10px;
          background:#fff1f2;
          color:#9f1239;
        }

        .madecc-ai-library-item {
          padding:10px;
          border-bottom:1px solid #edf0f4;
        }

        @media(max-width:850px) {
          .madecc-ai-workspace {
            grid-template-columns:1fr;
          }
        }
      `}</style>

      <div className="madecc-ai-top">
        <div className="madecc-ai-title">
          ✦ MADECC AI Studio
        </div>

        <div className="madecc-ai-subtitle">
          Create • Transform • Analyze • Automate
        </div>
      </div>

      <div className="madecc-ai-tabs">
        {tabs.map(
          (item) => (
            <button
              key={item.id}
              className={`madecc-ai-tab ${
                tab === item.id
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setTab(
                  item.id
                );
                setResult(
                  null
                );
                setError(
                  ""
                );
              }}
            >
              {item.icon}{" "}
              {item.label}
            </button>
          )
        )}
      </div>

      <div className="madecc-ai-workspace">
        <section className="madecc-ai-card">
          <h2>
            {currentTab?.icon}{" "}
            {currentTab?.label}
          </h2>

          <p
            style={{
              color:
                "#718096",
            }}
          >
            MADECC AI Studio
            connects your
            construction
            intelligence,
            documents,
            projects and
            media workflows.
          </p>

          <textarea
            className="madecc-ai-textarea"
            value={prompt}
            onChange={(event) =>
              setPrompt(
                event.target
                  .value
              )
            }
            placeholder={
              tab ===
              "chat"
                ? "Ask MADECC AI anything about construction, BOQ, projects, business or media..."
                : "Describe what you want MADECC AI to create or analyze..."
            }
          />

          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap:10,
              marginTop:12,
            }}
          >
            <input
              value={
                projectId
              }
              onChange={(event) =>
                setProjectId(
                  event.target
                    .value
                )
              }
              placeholder="Project ID (optional)"
              className="madecc-ai-select"
            />

            <select
              className="madecc-ai-select"
              value={
                language
              }
              onChange={(event) =>
                setLanguage(
                  event.target
                    .value
                )
              }
            >
              <option>
                English
              </option>
              <option>
                French
              </option>
            </select>
          </div>

          {tab ===
            "audio" && (
            <div>
              <select
                className="madecc-ai-select"
                value={
                  voice
                }
                onChange={(
                  event
                ) =>
                  setVoice(
                    event.target
                      .value
                  )
                }
              >
                <option value="Kore">
                  Kore
                </option>
                <option value="Puck">
                  Puck
                </option>
                <option value="Aoede">
                  Aoede
                </option>
                <option value="Charon">
                  Charon
                </option>
              </select>
            </div>
          )}

          {tab ===
            "global" && (
            <select
              className="madecc-ai-select"
              value={
                targetLanguage
              }
              onChange={(
                event
              ) =>
                setTargetLanguage(
                  event.target
                    .value
                )
              }
            >
              <option>
                French
              </option>
              <option>
                English
              </option>
              <option>
                Spanish
              </option>
              <option>
                German
              </option>
              <option>
                Portuguese
              </option>
            </select>
          )}

          {(tab ===
            "video" ||
            tab ===
              "media") && (
            <select
              className="madecc-ai-select"
              value={
                aspectRatio
              }
              onChange={(
                event
              ) =>
                setAspectRatio(
                  event.target
                    .value as
                    | "16:9"
                    | "9:16"
                )
              }
            >
              <option value="16:9">
                Landscape 16:9
              </option>
              <option value="9:16">
                Portrait 9:16
              </option>
            </select>
          )}

          <div className="madecc-ai-actions">
            {tab ===
              "chat" && (
              <button
                className="madecc-ai-button"
                onClick={
                  runChat
                }
                disabled={
                  loading
                }
              >
                ✦ Ask MADECC AI
              </button>
            )}

            {tab ===
              "video" && (
              <>
                <button
                  className="madecc-ai-button"
                  onClick={
                    runVideo
                  }
                  disabled={
                    loading
                  }
                >
                  🎬 Generate Video
                </button>

                <button
                  className="madecc-ai-button secondary"
                  onClick={() =>
                    fileRef.current?.click()
                  }
                >
                  🎥 Analyze Video
                </button>
              </>
            )}

            {tab ===
              "audio" && (
              <button
                className="madecc-ai-button"
                onClick={
                  runSpeech
                }
                disabled={
                  loading
                }
              >
                🔊 Generate Voice
              </button>
            )}

            {tab ===
              "media" && (
              <>
                <button
                  className="madecc-ai-button"
                  onClick={
                    runImage
                  }
                  disabled={
                    loading
                  }
                >
                  🎨 Generate Image
                </button>

                <button
                  className="madecc-ai-button secondary"
                  onClick={() =>
                    fileRef.current?.click()
                  }
                >
                  🖼 Analyze Image
                </button>
              </>
            )}

            {tab ===
              "transcribe" && (
              <button
                className="madecc-ai-button"
                onClick={() =>
                  fileRef.current?.click()
                }
              >
                🎙 Upload Audio
              </button>
            )}

            {tab ===
              "documents" && (
              <button
                className="madecc-ai-button"
                onClick={() =>
                  fileRef.current?.click()
                }
              >
                📄 Analyze Document
              </button>
            )}

            {tab ===
              "drawings" && (
              <button
                className="madecc-ai-button"
                onClick={() =>
                  fileRef.current?.click()
                }
              >
                🏗 Generate BOQ
              </button>
            )}

            {tab ===
              "global" && (
              <button
                className="madecc-ai-button"
                onClick={
                  runTranslation
                }
                disabled={
                  loading
                }
              >
                🌍 Translate
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            hidden
            accept={
              tab ===
              "transcribe"
                ? "audio/*"
                : tab ===
                  "video"
                ? "video/*"
                : tab ===
                  "documents"
                ? ".pdf,.doc,.docx,.txt"
                : tab ===
                  "drawings"
                ? ".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.ifc"
                : "image/*"
            }
            onChange={
              handleFile
            }
          />

          {loading && (
            <div
              style={{
                marginTop:20,
                padding:15,
                background:
                  "#f8fafc",
                borderRadius:10,
              }}
            >
              ⏳ MADECC AI is
              processing your
              request...
            </div>
          )}

          {error && (
            <div className="madecc-ai-error">
              ⚠ {error}
            </div>
          )}

          {result && (
            <div className="madecc-ai-result">
              <h3>
                Result
              </h3>

              {result.url && (
                <div>
                  {result.url.includes(
                    ".mp4"
                  ) ? (
                    <video
                      className="madecc-ai-media"
                      controls
                      src={
                        result.url
                      }
                    />
                  ) : result.url.includes(
                      ".png"
                    ) ||
                    result.url.includes(
                      ".jpg"
                    ) ? (
                    <img
                      className="madecc-ai-media"
                      src={
                        result.url
                      }
                      alt="MADECC AI generated"
                    />
                  ) : (
                    <audio
                      controls
                      style={{
                        width:
                          "100%",
                      }}
                      src={
                        result.url
                      }
                    />
                  )}
                </div>
              )}

              {result.text && (
                <>
                  <div className="madecc-ai-result-text">
                    {
                      result.text
                    }
                  </div>

                  <div className="madecc-ai-actions">
                    <button
                      className="madecc-ai-button secondary"
                      onClick={() =>
                        downloadText(
                          result.text!,
                          "madecc-ai-output.txt"
                        )
                      }
                    >
                      ⬇ Download TXT
                    </button>
                  </div>
                </>
              )}

              {result.transcript && (
                <>
                  <div className="madecc-ai-result-text">
                    {
                      result.transcript
                    }
                  </div>

                  <button
                    className="madecc-ai-button secondary"
                    onClick={() =>
                      downloadText(
                        result.transcript!,
                        "madecc-transcript.txt"
                      )
                    }
                  >
                    ⬇ Download Transcript
                  </button>
                </>
              )}

              {result.analysis && (
                <>
                  <div className="madecc-ai-result-text">
                    {
                      result.analysis
                    }
                  </div>

                  <button
                    className="madecc-ai-button secondary"
                    onClick={() =>
                      downloadText(
                        result.analysis!,
                        "madecc-ai-analysis.txt"
                      )
                    }
                  >
                    ⬇ Download Analysis
                  </button>
                </>
              )}

              {result.boq && (
                <div>
                  <pre
                    className="madecc-ai-result-text"
                  >
                    {JSON.stringify(
                      result.boq,
                      null,
                      2
                    )}
                  </pre>

                  <button
                    className="madecc-ai-button secondary"
                    onClick={() =>
                      downloadText(
                        JSON.stringify(
                          result.boq,
                          null,
                          2
                        ),
                        "madecc-ai-boq.json"
                      )
                    }
                  >
                    ⬇ Download BOQ JSON
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="madecc-ai-card">
          <h3>
            AI Media Library
          </h3>

          <p
            style={{
              color:
                "#718096",
              fontSize:13,
            }}
          >
            Saved MADECC AI
            assets.
          </p>

          {mediaLibrary
            .slice(0, 20)
            .map(
              (media) => (
                <div
                  key={
                    media.id
                  }
                  className="madecc-ai-library-item"
                >
                  <strong>
                    {
                      media.name
                    }
                  </strong>

                  <div
                    style={{
                      color:
                        "#718096",
                      fontSize:11,
                      marginTop:4,
                    }}
                  >
                    {
                      media.type
                    }
                  </div>

                  {media.url && (
                    <a
                      href={
                        media.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize:12,
                      }}
                    >
                      Open
                    </a>
                  )}
                </div>
              )
            )}

          <hr />

          <h4>
            Quick Prompts
          </h4>

          {quickPrompts.map(
            (item) => (
              <button
                key={item}
                className="madecc-ai-button secondary"
                style={{
                  width:
                    "100%",
                  marginBottom:7,
                  textAlign:
                    "left",
                }}
                onClick={() =>
                  setPrompt(
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}
        </aside>
      </div>
    </div>
  );
}
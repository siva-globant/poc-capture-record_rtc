import { useRef, useState } from "react";
import RecordRTC from "recordrtc";

import type { ChangeEvent } from "react";

import "./App.css";
import {
  useMonitoring,
  SentryOperation,
  SentryTransaction,
  SentryTag,
  SentrySpan,
} from "./context";

type ResolutionValueUnions =
  | "default"
  | "1920x1080"
  | "1280x720"
  | "640x480"
  | "3840x2160";
type BitRateValueUnions =
  | "default"
  | "8000000000"
  | "800000000"
  | "8000000"
  | "800000"
  | "8000"
  | "800";
type FrameRateValueUnions = "default" | "15" | "24" | "30" | "60";

interface ISelectRecord<T = string> {
  label: string;
  value: T;
}
const RESOLUTIONS: Array<ISelectRecord<ResolutionValueUnions>> = [
  {
    label: "Default",
    value: "default",
  },
  {
    label: "4K Ultra HD (3840x2160)",
    value: "3840x2160",
  },
  {
    label: "1080p",
    value: "1920x1080",
  },
  {
    label: "720p",
    value: "1280x720",
  },
  {
    label: "480p",
    value: "640x480",
  },
];
const BIT_RATES: Array<ISelectRecord<BitRateValueUnions>> = [
  {
    label: "Default bps",
    value: "default",
  },
  {
    label: "1 GB bps",
    value: "8000000000",
  },
  {
    label: "100 MB bps",
    value: "800000000",
  },
  {
    label: "1 MB bps",
    value: "8000000",
  },
  {
    label: "100 KB bps",
    value: "800000",
  },
  {
    label: "1 KB bps",
    value: "8000",
  },
  {
    label: "100 Bytes bps",
    value: "800",
  },
];
const FRAME_RATES: Array<ISelectRecord<FrameRateValueUnions>> = [
  {
    label: "Default FPS",
    value: "default",
  },
  {
    label: "15 FPS",
    value: "15",
  },
  {
    label: "24 FPS",
    value: "24",
  },
  {
    label: "30 FPS",
    value: "30",
  },
  {
    label: "60 FPS",
    value: "60",
  },
];

interface IRecordedVideoState {
  url: string;
  name: string;
  resolution: string;
  bitRate: string;
  frameRate: string;
  size: string;
  type: string;
  videoHeight?: number;
  videoWidth?: number;
  duration?: number;
}
function App() {
  const mediaRecordRef = useRef<RecordRTC | null>(null);
  const liveStream = useRef<HTMLVideoElement>(null);
  const mediaStream = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState<boolean>(false);

  const [currentResolution, setCurrentResolution] =
    useState<ResolutionValueUnions>("default");
  const [currentBitRate, setCurrentBitRate] =
    useState<BitRateValueUnions>("default");
  const [currentFrameRate, setCurrentFrameRate] =
    useState<FrameRateValueUnions>("default");

  const [recordedVideo, setRecordedVideo] = useState<IRecordedVideoState[]>([]);

  const { measurePerformance } = useMonitoring();

  const bytesToSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes == 0) return "n/a";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i == 0) return bytes + " " + sizes[i];
    return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
  };

  const getCameraPermission = async () => {
    try {
      const [mediaWidth, mediaHeight] =
        currentResolution === "default" ? [] : currentResolution.split("x");
      const videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: Number(mediaWidth),
          height: Number(mediaHeight),
          frameRate:
            currentFrameRate === "default"
              ? undefined
              : Number(currentFrameRate),
        },
      });
      mediaStream.current = new MediaStream(videoStream);
      if (liveStream.current) {
        liveStream.current.srcObject = videoStream;
      }
    } catch (e) {
      console.log(e);
    }
  };

  const startVideoRecording = async () => {
    const transaction = measurePerformance(
      SentryTransaction.VIDEO_PROCESSING,
      SentryOperation.VIDEO_CAPTURE
    );
    transaction.setTag(
      SentryTag.INSPECTION_ID,
      `Random-${Math.floor(Math.random() * 100)}`
    );

    transaction.startSpan(SentrySpan.ASK_PERMISSION, null);
    await getCameraPermission();
    transaction.finishSpan(SentrySpan.ASK_PERMISSION);

    transaction.startSpan(SentrySpan.TAKE_VIDEO, null);
    setIsRecording(true);
    if (!mediaStream.current) return alert("Cannot record Now");
    const media = new RecordRTC(mediaStream.current, {
      type: "video",
    });
    mediaRecordRef.current = media;
    const { startRecording } = mediaRecordRef.current;

    startRecording();
  };

  const stopVideoRecording = () => {
    setIsRecording(false);
    if (!mediaRecordRef.current) return;
    const { stopRecording, getBlob, toURL, reset } = mediaRecordRef.current;

    stopRecording(() => {
      const blob = getBlob(),
        url = toURL();
      const currentRecordVideoInfo = {
        name: `VideoRecord-${recordedVideo.length + 1}`,
        resolution: currentResolution,
        bitRate: currentBitRate,
        frameRate: currentFrameRate,
        size: bytesToSize(blob.size),
        type: blob.type,
        url,
      };
      setRecordedVideo((prevState) => [...prevState, currentRecordVideoInfo]);
      if (mediaStream.current)
        mediaStream.current.getTracks().forEach((track) => track.stop());
      if (liveStream.current) liveStream.current.srcObject = null;
    });
  };

  const onResolutionChange = (
    event: ChangeEvent<HTMLSelectElement> & {
      target: { value: ResolutionValueUnions };
    }
  ) => {
    setCurrentResolution(event.target.value);
  };
  const onBitRateChange = (
    event: ChangeEvent<HTMLSelectElement> & {
      target: { value: BitRateValueUnions };
    }
  ) => {
    setCurrentBitRate(event.target.value);
  };
  const onFrameRateChange = (
    event: ChangeEvent<HTMLSelectElement> & {
      target: { value: FrameRateValueUnions };
    }
  ) => {
    setCurrentFrameRate(event.target.value);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div>
        <h3>
          POC Video Capture -{" "}
          <a target="_blank" href="https://siva-globant.github.io/poc-capture/">
            Native
          </a>{" "}
          |{" "}
          <a
            target="_blank"
            href="https://siva-globant.github.io/poc-capture-EMR/"
          >
            ExtendableMediaRecorder
          </a>{" "}
          | Record RTC | <span style={{ opacity: 0.5 }}>Record WebCam</span>
        </h3>
      </div>
      <div
        style={{
          display: "flex",
          gap: "36px",
        }}
      >
        <div style={{ flex: 8 }}>
          <div
            style={{
              height: "80vh",
              backgroundColor: "greenyellow",
            }}
          >
            <video
              style={{ width: "100%", height: "100%", aspectRatio: 16 / 9 }}
              ref={liveStream}
              autoPlay
              muted
              playsInline
            />
          </div>
          <div>
            <select value={currentResolution} onChange={onResolutionChange}>
              {RESOLUTIONS.map(({ label, value }) => (
                <option key={`resolutions#${value}`} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={currentBitRate} onChange={onBitRateChange}>
              {BIT_RATES.map(({ label, value }) => (
                <option key={`bit_rates#${value}`} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={currentFrameRate} onChange={onFrameRateChange}>
              {FRAME_RATES.map(({ label, value }) => (
                <option key={`frame_rates#${value}`} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <br />
            <button
              onClick={isRecording ? stopVideoRecording : startVideoRecording}
            >
              {isRecording ? "Stop Recording" : "Start Record"}
            </button>
          </div>
        </div>
        <div
          style={{
            flex: 3,
            maxHeight: "80vh",
            overflowY: "scroll",
          }}
        >
          {recordedVideo.map((ele, index) => (
            <div
              key={`Video#${index}`}
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: "grey",
                padding: "8px",
                margin: "8px 0px",
              }}
            >
              <video
                onLoadedMetadata={(event) => {
                  const { duration, videoHeight, videoWidth } =
                    event.currentTarget;
                  setRecordedVideo((prevState) => {
                    prevState[index] = {
                      ...prevState[index],
                      duration,
                      videoHeight,
                      videoWidth,
                    };
                    return [...prevState];
                  });

                  console.log(index, {
                    duration,
                    videoHeight,
                    videoWidth,
                  });
                }}
                style={{ width: "150px", aspectRatio: 16 / 9 }}
                controls
                src={ele.url}
              />
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  flexWrap: "wrap",
                  justifyContent: "space-around",
                }}
              >
                {Object.keys(ele)
                  .filter((e) => !["url"].includes(e))
                  .map((eleKey) => (
                    <p key={eleKey}>
                      {/* @ts-ignore */}
                      {eleKey}:{ele[eleKey]}
                    </p>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;

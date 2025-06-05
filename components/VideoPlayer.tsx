"use client";

import { cn, createIframeLink } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  incrementVideoViews,
  getVideoProcessingStatus,
} from "@/lib/actions/video";
import { initialVideoState } from "@/constants";

// Define props if not already globally available or imported
interface VideoPlayerProps {
  videoId: string;
  className?: string;
}

// Define a more specific type for the state for better type safety and clarity
interface VideoPlayerState {
  isProcessing: boolean;
  isLoaded: boolean;
  hasIncrementedView: boolean;
  // You could extend this with error states if needed for more granular UI feedback
  // processingError: string | null;
  // viewIncrementError: string | null;
}

const VideoPlayer = ({ videoId, className }: VideoPlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Use a more descriptive name for state and its setter, and apply the specific type
  const [playerState, setPlayerState] = useState<VideoPlayerState>(initialVideoState);

  // Effect for checking video processing status and polling
  useEffect(() => {
    let isEffectMounted = true; // Flag to prevent state updates if component unmounts during async ops
    let pollingIntervalId: NodeJS.Timeout | undefined;

    const checkAndHandleProcessingStatus = async () => {
      try {
        const status = await getVideoProcessingStatus(videoId);
        if (isEffectMounted) {
          setPlayerState((prevState) => ({
            ...prevState,
            isProcessing: !status.isProcessed,
            // processingError: null, // Reset error on successful fetch
          }));
        }
        return status.isProcessed;
      } catch (error) {
        console.error("Error fetching video processing status:", error);
        if (isEffectMounted) {
          // Optionally, handle error state, e.g., stop polling or show an error
          // setPlayerState((prevState) => ({
          //   ...prevState,
          //   isProcessing: false, // Or true, depending on desired retry behavior
          //   processingError: "Failed to fetch status. Retrying...",
          // }));
        }
        return false; // Assume not processed or error occurred
      }
    };

    const initializeProcessingCheck = async () => {
      const isInitiallyProcessed = await checkAndHandleProcessingStatus();

      if (isEffectMounted && !isInitiallyProcessed) {
        // If not processed initially, start polling
        pollingIntervalId = setInterval(async () => {
          const isNowProcessed = await checkAndHandleProcessingStatus();
          if (isNowProcessed) {
            if (pollingIntervalId) clearInterval(pollingIntervalId);
          }
        }, 3000);
      }
    };

    initializeProcessingCheck();

    // Cleanup function for the effect
    return () => {
      isEffectMounted = false;
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [videoId]); // Re-run effect if videoId changes

  // Effect for incrementing video views
  useEffect(() => {
    let isEffectMounted = true; // Flag for this effect's async operations

    // Conditions for incrementing view: video loaded, view not yet incremented, and not processing
    if (playerState.isLoaded && !playerState.hasIncrementedView && !playerState.isProcessing) {
      const attemptIncrementView = async () => {
        try {
          await incrementVideoViews(videoId);
          if (isEffectMounted) {
            setPlayerState((prevState) => ({
              ...prevState,
              hasIncrementedView: true,
              // viewIncrementError: null, // Reset error
            }));
          }
        } catch (error) {
          console.error("Failed to increment view count:", error);
          if (isEffectMounted) {
            // Optionally handle view increment error state
            // setPlayerState((prevState) => ({ ...prevState, viewIncrementError: "Failed to increment view." }));
          }
        }
      };

      attemptIncrementView();
    }

    // Cleanup for this effect
    return () => {
      isEffectMounted = false;
    };
  }, [videoId, playerState.isLoaded, playerState.hasIncrementedView, playerState.isProcessing]); // Dependencies for this effect

  return (
    <div className={cn("video-player relative h-full w-full", className)}> {/* Added relative for potential absolute children & h-full/w-full */}
      {playerState.isProcessing ? (
        <div className="flex h-full w-full items-center justify-center bg-black text-white"> {/* Basic styling for processing message */}
          <p>Processing video, please wait...</p> {/* Slightly more informative message */}
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={createIframeLink(videoId)}
          loading="lazy"
          title="Video player"
          style={{ border: 0, width: "100%", height: "100%", zIndex: 50 }} // Ensured width/height 100%
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => {
            // No need for isEffectMounted here as onLoad is a direct DOM event callback
            // and will only fire if the iframe element itself is still part of the DOM.
            setPlayerState((prevState) => ({ ...prevState, isLoaded: true }));
          }}
        />
      )}
    </div>
  );
};

export default VideoPlayer;
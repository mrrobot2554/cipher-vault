"use client";

import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, Status, Step } from 'react-joyride';
import { updateUserTourStatus } from "@/lib/utils";
import { getCurrentUser } from "@/lib/actions/user.actions";

const steps: Step[] = [
  {
    target: '.uploader-button',
    content: 'Click here to upload your files!',
  },
  {
    target: '.sidebar-nav',
    content: 'Check your files by document type.',
  },
  {
    target: '.search-bar',
    content: 'Search your files by name here.',
  },
  {
    target: '.storage-details',
    content: 'Check your storage usage here.',
  },
  {
    target: '.action-btns',
    content: 'Click here to perform actions like rename, delete, download or share files, etc.',
  },
];

export const TourGuide = () => {
  const [run, setRun] = useState(false);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const startTour = async () => {
    try {
      const user = await getCurrentUser();
      const hasSeenTour = user.hasSeenTour;

      if (!hasSeenTour || hasSeenTour === null) {
        setUserId(user.$id);
        setRun(true);
      }
    } catch (err: any) {
      console.error("Error fetching tour status", err);
    }
    setLoading(false);
  };

  const handleTourCallback = async (data: any) => {
    const { status } = data;
    if ((status === STATUS.FINISHED || status === STATUS.SKIPPED) && userId) {
      try {
        await updateUserTourStatus(userId);
      } catch (err) {
        console.error("Failed to update tour status:", err);
      }
    }
  };

  useEffect(() => {
    startTour();
  }, []);

  if (loading) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleTourCallback}
      styles={{
        options: {
          zIndex: 10000,
        },
      }}
    />
  );
};

export default TourGuide;

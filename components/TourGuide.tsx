'use client';

import React, { useState } from 'react';
import Joyride, { CallBackProps, STATUS, Status } from 'react-joyride';

const TourGuide = () => {
  const [run, setRun] = useState(true);

  const steps = [
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

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finished = status === STATUS.FINISHED || status === STATUS.SKIPPED;
    if (finished) {
      setRun(false);
      localStorage.setItem('hasSeenTour', 'true');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          zIndex: 10000,
        },
      }}
    />
  );
};

export default TourGuide;

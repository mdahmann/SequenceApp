// Main Dependencies
// React for Frontend Development, Axios for API Integration
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css'; // Assume a minimalist black-and-white CSS is present

const App = () => {
  // States for Filters and Generated Sequence
  const [length, setLength] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [style, setStyle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [poses, setPoses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const placeholderImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23DAE5D0'/%3E%3Cpath d='M150 70c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 140c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50zm0-120c-38.7 0-70 31.3-70 70s31.3 70 70 70 70-31.3 70-70-31.3-70-70-70z' fill='%2389B5AF'/%3E%3C/svg%3E";
  const [showFilters, setShowFilters] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Reference for scrolling
  const activeCardRef = useRef(null);

  // Helper function to parse duration string to seconds
  const parseDuration = (durationStr) => {
    const minutes = parseInt(durationStr.match(/(\d+)\s*min/)?.[1] || '0');
    return minutes * 60;
  };

  // Timer logic
  useEffect(() => {
    let timer;
    if (isPlaying && poses.length > 0) {
      const currentPose = poses[currentPoseIndex];
      const duration = parseDuration(currentPose.duration); // Convert duration to seconds

      setTimeRemaining(duration);
      
      timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Move to next pose
            if (currentPoseIndex < poses.length - 1) {
              setCurrentPoseIndex(prev => prev + 1);
              setProgress(0);
            } else {
              setIsPlaying(false);
              return 0;
            }
          }
          setProgress(((duration - prev + 1) / duration) * 100);
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [isPlaying, currentPoseIndex, poses]);

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Add this function to fetch pose data from the API
  const fetchPoseImage = async (poseName) => {
    try {
      // First try to get all poses
      const response = await axios.get('https://yoga-api-nzy4.onrender.com/v1/poses');
      
      if (response.data) {
        // Find the pose that best matches our name
        const pose = response.data.find(p => 
          p.english_name.toLowerCase().includes(poseName.toLowerCase()) ||
          poseName.toLowerCase().includes(p.english_name.toLowerCase())
        );
        
        if (pose) {
          return {
            svg: pose.url_svg,
            png: pose.url_png,
            sanskrit: pose.sanskrit_name,
            benefits: pose.pose_benefits
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching pose image:', error);
      return null;
    }
  };

  // Handle sequence generation
  const handleGenerateSequence = async () => {
    try {
      setIsLoading(true);
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-3.5-turbo",
        messages: [{
          role: "user",
          content: `Create a yoga sequence with the following parameters:
            Length: ${length}
            Difficulty: ${difficulty}
            Yoga Style: ${style}
            Custom Request: ${customPrompt}
            
            Please return the response as a JSON array of poses, where each pose has:
            - name: the name of the pose (use common English names)
            - sanskrit: the Sanskrit name
            - duration: how long to hold it
            - description: brief instructions
            Format: [{"name": "pose name", "sanskrit": "sanskrit name", "duration": "duration", "description": "description"}]`
        }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        }
      });

      const poseSequence = JSON.parse(response.data.choices[0].message.content);
      
      // Fetch images for each pose
      const posesWithImages = await Promise.all(
        poseSequence.map(async (pose) => {
          const poseData = await fetchPoseImage(pose.name);
          return {
            ...pose,
            imageUrl: poseData?.png || placeholderImage,
            sanskrit: poseData?.sanskrit || pose.sanskrit,
            benefits: poseData?.benefits || pose.description
          };
        })
      );
      
      setPoses(posesWithImages);
      setShowFilters(false); // Hide filters after generation
    } catch (error) {
      console.error('Error:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        handleExitFullscreen();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Handle exiting fullscreen
  const handleExitFullscreen = () => {
    setIsFullscreen(false);
    setIsPlaying(false);
  };

  // Handle play button click
  const handlePlay = () => {
    setIsPlaying(true);
    setIsFullscreen(true);
    if (!timeRemaining) {
      const currentPose = poses[currentPoseIndex];
      setTimeRemaining(parseDuration(currentPose.duration));
    }
    setProgress(0);
    window.scrollTo(0, 0);
  };

  // Scroll active pose into view when it changes
  useEffect(() => {
    if (isPlaying && activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [currentPoseIndex, isPlaying]);

  // Calculate total sequence time when poses are loaded or edited
  useEffect(() => {
    if (poses.length > 0) {
      const total = poses.reduce((sum, pose) => {
        return sum + parseDuration(pose.duration);
      }, 0);
      setTotalTime(total);
      
      // Reset elapsed time when sequence is edited
      if (!isPlaying) {
        setElapsedTime(0);
        setCurrentPoseIndex(0);
      }
    }
  }, [poses]);

  // Update elapsed time based on completed poses and current pose progress
  useEffect(() => {
    if (poses.length > 0) {
      const completedPosesTime = poses.slice(0, currentPoseIndex).reduce((sum, pose) => {
        return sum + parseDuration(pose.duration);
      }, 0);
      
      const currentPoseDuration = parseDuration(poses[currentPoseIndex].duration);
      const currentPoseElapsed = currentPoseDuration - (timeRemaining || 0);
      
      setElapsedTime(completedPosesTime + currentPoseElapsed);
    }
  }, [currentPoseIndex, timeRemaining, poses]);

  // Format time for display (HH:MM:SS)
  const formatTimeExtended = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle edit sequence
  const handleEditSequence = () => {
    setShowFilters(true);
    setIsPlaying(false);
    setIsFullscreen(false);
    setCurrentPoseIndex(0);
    setTimeRemaining(0);
    setElapsedTime(0);
    setProgress(0);
  };

  // JSX for Frontend Elements
  return (
    <div className="app">
      <header className="app-header">
        <h1>Sequence - Create Your Yoga Flow</h1>
      </header>

      <div className={`filters-section ${!showFilters ? 'hidden' : ''}`}>
        <div className="filters-section">
          <label>Length of Class</label>
          <select value={length} onChange={(e) => setLength(e.target.value)}>
            <option value="">Select Length</option>
            <option value="15 min">15 min</option>
            <option value="30 min">30 min</option>
            <option value="60 min">60 min</option>
          </select>

          <label>Difficulty Level</label>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Select Difficulty</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          <label>Yoga Style</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">Select Style</option>
            <option value="Vinyasa">Vinyasa</option>
            <option value="Yin/Restorative">Yin/Restorative</option>
            <option value="Core Power">Core Power</option>
          </select>

          <label>Custom Text Prompt</label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Any specific request or focus for this sequence?"
          />

          <button onClick={handleGenerateSequence}>Generate Sequence</button>
        </div>
      </div>

      {!showFilters && (
        <button 
          className="edit-sequence-button"
          onClick={handleEditSequence}
        >
          Edit Sequence
        </button>
      )}

      {isLoading && (
        <div className="loading-spinner">
          <div></div>
          <div></div>
          <div></div>
        </div>
      )}
      
      {!isLoading && poses.length > 0 && (
        <div className={`sequence-display ${isFullscreen ? 'fullscreen' : ''}`}>
          {isFullscreen && (
            <button 
              className="exit-fullscreen"
              onClick={handleExitFullscreen}
              aria-label="Exit fullscreen"
            >
              ✕
            </button>
          )}
          
          <h2>Your Yoga Sequence</h2>
          <div className="pose-grid">
            {poses.map((pose, index) => (
              <div 
                className={`pose-card ${index === currentPoseIndex ? 'active-pose' : ''}`}
                key={index}
                ref={index === currentPoseIndex ? activeCardRef : null}
              >
                <div className="pose-image">
                  <img 
                    src={pose.imageUrl} 
                    alt={pose.name}
                    onError={(e) => {
                      e.target.src = placeholderImage;
                    }}
                  />
                </div>
                <div className="pose-content">
                  {index === currentPoseIndex && (
                    <div 
                      className="progress-overlay"
                      style={{"--progress": `${progress}%`}}
                    />
                  )}
                  <h3>{pose.name}</h3>
                  <p className="sanskrit">{pose.sanskrit}</p>
                  <p className="duration">{pose.duration}</p>
                  <p className="description">{pose.benefits}</p>
                  {index === currentPoseIndex && (
                    <div className="timer-display">
                      {formatTime(timeRemaining)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="sequence-controls">
            <div className="sequence-progress">
              <div 
                className="progress-bar" 
                style={{
                  width: `${(elapsedTime / totalTime) * 100}%`
                }}
              />
            </div>
            
            <div className="player-controls">
              <div className="playback-controls">
                <button 
                  className="control-button"
                  onClick={() => setCurrentPoseIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentPoseIndex === 0}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" fill="currentColor"/>
                  </svg>
                </button>
                
                <button 
                  className="control-button play-button"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" fill="currentColor"/>
                    </svg>
                  )}
                </button>
                
                <button 
                  className="control-button"
                  onClick={() => setCurrentPoseIndex(prev => Math.min(poses.length - 1, prev + 1))}
                  disabled={currentPoseIndex === poses.length - 1}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/>
                  </svg>
                </button>
              </div>

              <div className="time-display">
                <span>{formatTimeExtended(elapsedTime)}</span>
                <span className="time-separator">/</span>
                <span>{formatTimeExtended(totalTime)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

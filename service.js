import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function() {
  // Event handler for remote play (notification, lock screen, etc.)
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error in RemotePlay handler:', error);
    }
  });

  // Event handler for remote pause (notification, lock screen, etc.)
  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Error in RemotePause handler:', error);
    }
  });

  // Event handler for remote stop (notification, lock screen, etc.)
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    try {
      await TrackPlayer.stop();
    } catch (error) {
      console.error('Error in RemoteStop handler:', error);
    }
  });

  // Event handler for remote seek (scrubbing on lock screen)
  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    try {
      await TrackPlayer.seekTo(event.position);
    } catch (error) {
      console.error('Error in RemoteSeek handler:', error);
    }
  });

  // Event handler for playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('TrackPlayer playback error:', event);
  });

  // Note: updateOptions is handled in PodcastContext to avoid duplication
};
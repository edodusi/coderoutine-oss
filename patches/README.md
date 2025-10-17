# Patches

This directory contains patches for npm packages that need fixes.

## react-native-track-player+4.1.2.patch

**Issue**: Kotlin null safety compilation error on Android
**Lines affected**: 548, 588 in MusicModule.kt
**Fix**: Added null checks for `originalItem` before passing to `Arguments.fromBundle()`

The original code:
```kotlin
Arguments.fromBundle(musicService.tracks[index].originalItem)
```

Was changed to:
```kotlin
val originalItem = musicService.tracks[index].originalItem
callback.resolve(if (originalItem != null) Arguments.fromBundle(originalItem) else null)
```

This fixes the Kotlin compiler error:
```
Argument type mismatch: actual type is 'Bundle?', but 'Bundle' was expected.
```

The patch is automatically applied after `npm install` via the `postinstall` script.

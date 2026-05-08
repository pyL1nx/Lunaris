/**
 * File utilities — simplified for JSON-based architecture.
 * Asset management now handled by Rust commands.
 */

/**
 * Open native file dialog to pick an .exe file.
 */
export async function pickExeFile(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      multiple: false,
      title: 'Select Game Executable',
      filters: [
        { name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result as string | null;
  } catch {
    console.warn('File dialog not available (browser mode)');
    return null;
  }
}

/**
 * Open native file dialog to pick a directory.
 */
export async function pickDirectory(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      multiple: false,
      directory: true,
      title: 'Select Game Root Directory',
    });
    return result as string | null;
  } catch {
    console.warn('File dialog not available (browser mode)');
    return null;
  }
}

/**
 * Open native file dialog to pick an image file.
 */
export async function pickImageFile(title: string): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      multiple: false,
      title,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      ],
    });
    return result as string | null;
  } catch {
    console.warn('File dialog not available (browser mode)');
    return null;
  }
}

/**
 * Convert an absolute file path to a displayable asset:// URL.
 */
export async function convertToAssetUrl(absolutePath: string): Promise<string | null> {
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(absolutePath);
  } catch {
    return null;
  }
}

/**
 * Open native file dialog to pick a ROM / ISO file for emulated games.
 */
export async function pickRomFile(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const result = await open({
      multiple: false,
      title: 'Select ROM / ISO',
      filters: [
        { name: 'Game Files', extensions: ['iso', 'cso', 'nsp', 'xci', 'wbfs', 'gcm', 'nds', 'gba', 'nes', 'sfc', 'z64', 'n64', 'bin', 'cue', 'chd', 'pkg', 'elf', 'rpx', 'wud', 'wux'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result as string | null;
  } catch {
    console.warn('File dialog not available (browser mode)');
    return null;
  }
}

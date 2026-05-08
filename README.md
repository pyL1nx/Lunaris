**🌙 Lunaris Launcher**

The ultimate PS5-style unified dashboard for your gaming library. Experience seamless metadata integration, high-fidelity visuals, and real-time achievement tracking for all your games.

--- 

**Overview**

Lunaris is more than just a game launcher; it’s a high-performance metadata bridge. Designed with a sleek glassmorphic UI, it brings official Steam-level features—like achievements, playtime tracking, and dynamic banners—to your entire collection, including DRM-free titles and emulated games.

---

**Real-Time Achievement Tracking**

Lunaris uses a custom-built bridge to sync local game progress with official Steam metadata.

**Pre-Requisites**

Goldberg Emulator: [Download](https://mr_goldberg.gitlab.io/goldberg_emulator/)

Steam Web API Key: [API KEY](https://steamcommunity.com/dev/apikey)

SteamDB: [Look up AppIDs here](https://steamdb.info/)

**Enabling the System**

App Configuration: Click the Profile Icon in Lunaris and paste your Steam Web API Key. This allows the app to fetch official icons and descriptions.

Goldberg Setup: Paste the Goldberg steam_api64.dll (or steam_api.dll) into your game's root directory where the original executable is located.

Adding the Game: * Open the Add Game menu.

Input the Steam AppID (from SteamDB).

Select your game's Executable (.exe) and the Game Root Directory.

Click Sync Achievements. Lunaris will automatically generate the necessary steam_settings and achievements.json for Goldberg.

Launch: Click Save. Your achievements will now trigger real-time UI updates in the Lunaris dashboard!

---

**Emulator Support**

Play your favorite console classics directly through the Lunaris interface.

In the Add Game menu, toggle the "Launch through Emulator" switch.

Select your Emulator Executable (e.g., Yuzu, Ryujinx, PCSX2).

Select your Game ROM/Image (.nsp, .iso, .bin).

Click Save and enjoy a unified console experience.

---

🎨 Aesthetic Guidelines
To keep your dashboard looking like a AAA console interface:

Backgrounds: Use 1920 x 1080p high-quality banners.

Icons: Square icons work best for the top navigation bar.


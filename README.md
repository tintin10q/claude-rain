# claude-rain
A browser extension that adds a subtle rain effect on claude.ai. Toggle with Ctrl+Alt+R.

# How to use?

Put the two files in a directory on your computer called `claude-rain`. 

## Chrome, Chromium or Brave

1. Go to chrome://extensions (Brave: brave://extensions).
2. Switch on Developer mode in the top right.
3. Click Load unpacked and choose the `claude-rain` directory, the folder with manifest.json in it.
4. Reload any claude.ai tabs you already have open

## Firefox

1. Go to about:debugging#/runtime/this-firefox.
2. Click Load Temporary Add-on… and select `claude-rain/manifest.json`.
3. Reload your claude.ai tabs.

Firefox removes temporary add-ons when it restarts. To keep it for good, you have two options:

1. Sign it as an unlisted add-on: upload a zip with the files to addons.mozilla.org. It doesn't become public, and you get a signed `.xpi` you can install normally.
2. Use Firefox Developer Edition or Nightly: set `xpinstall.signatures.required` to false in `about:config`

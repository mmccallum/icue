/**
 * Corsair iCUE SDK Downloader and Installer
 * Downloads the official LCUE.dll SDK library and configures paths
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const SDK_VERSION = '4.0.84';
const SDK_URL = `https://github.com/CorsairOfficial/cue-sdk/releases/download/v${SDK_VERSION}/iCUESDK_${SDK_VERSION}.zip`;
const TEMP_FILE = path.join(os.tmpdir(), `iCUESDK-${SDK_VERSION}.zip`);
const EXTRACT_DIR = path.join(__dirname, 'cue-sdk-download');
const REDIST_PATH = path.join(EXTRACT_DIR, 'iCUESDK', 'redist');

console.log('🔧 Corsair iCUE SDK Installer\n');

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading SDK from ${url}...`);
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      // Follow redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log('✅ Download complete');
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('✅ Download complete');
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete incomplete file
      reject(err);
    });
  });
}

async function extractZip(zipPath, extractTo) {
  console.log(`📦 Extracting SDK to ${extractTo}...`);
  
  // Use PowerShell Expand-Archive on Windows
  if (process.platform === 'win32') {
    try {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractTo}' -Force"`, {
        stdio: 'inherit'
      });
      console.log('✅ Extraction complete');
    } catch (error) {
      throw new Error(`Failed to extract: ${error.message}`);
    }
  } else {
    throw new Error('Non-Windows platform not supported yet');
  }
}

async function copySDKFiles() {
  console.log('📁 Looking for SDK DLL in redist folder...');
  
  // Expected paths - the DLL is actually named iCUESDK.x64_2019.dll
  const sdkDll64 = path.join(REDIST_PATH, 'x64', 'iCUESDK.x64_2019.dll');
  const sdkDll64Alt = path.join(REDIST_PATH, 'LCUE.dll');
  
  // Copy to multiple potential locations with standard name
  const destinations = [
    path.join(__dirname, '..', 'build', 'Release', 'iCUESDK.dll'),
    path.join(__dirname, '..', 'iCUESDK.dll'),
  ];
  
  let sourceDll = null;
  
  // Try iCUESDK.x64_2019.dll first (the actual file)
  if (fs.existsSync(sdkDll64)) {
    sourceDll = sdkDll64;
    console.log('✅ Found 64-bit iCUESDK.x64_2019.dll');
  } else if (fs.existsSync(sdkDll64Alt)) {
    sourceDll = sdkDll64Alt;
    console.log('✅ Found 64-bit LCUE.dll');
  }
  
  if (sourceDll) {
    for (const dest of destinations) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(sourceDll, dest);
      console.log(`   Copied to: ${dest}`);
    }
    return true;
  }
  
  console.warn('⚠️  Could not find SDK DLL in redist folder');
  console.warn(`    Expected: ${sdkDll64}`);
  return false;
}

function updateCorsairCC() {
  console.log('📝 Updating src/corsair.cc to load LCUE.dll...');
  
  const corsairCCPath = path.join(__dirname, 'src', 'corsair.cc');
  if (!fs.existsSync(corsairCCPath)) {
    console.warn('⚠️  src/corsair.cc not found, skipping update');
    return;
  }
  
  let content = fs.readFileSync(corsairCCPath, 'utf8');
  
  // Replace the paths array with SDK DLL paths
  const newPaths = `  // Try common iCUE SDK library paths
  const char *paths[] = {
    // Project directory (installed by setup script)
    "iCUESDK.dll",
    ".\\\\iCUESDK.dll",
    "build\\\\Release\\\\iCUESDK.dll",
    // iCUE 5.x installation paths
    "C:\\\\Program Files\\\\Corsair\\\\SDK\\\\iCUESDK.dll",
    "C:\\\\Program Files\\\\Corsair\\\\iCUESDK.dll",
    "C:\\\\Program Files\\\\Corsair\\\\Corsair iCUE5 Software\\\\iCUESDK.dll",
    "C:\\\\Program Files (x86)\\\\Corsair\\\\SDK\\\\iCUESDK.dll",
    "C:\\\\Program Files (x86)\\\\Corsair\\\\iCUESDK.dll",
    // Legacy iCUE 4.x (backward compatibility)
    "C:\\\\Program Files\\\\Corsair\\\\CORSAIR iCUE 4\\\\system\\\\iCUESDK.dll",
    "C:\\\\Program Files\\\\Corsair\\\\CORSAIR iCUE\\\\system\\\\iCUESDK.dll",
  };`;
  
  // Find and replace the paths array
  content = content.replace(
    /\/\/\s*Try common.*?const char \*paths\[\]\s*=\s*\{[\s\S]*?\};/,
    newPaths
  );
  
  fs.writeFileSync(corsairCCPath, content);
  console.log('✅ Updated src/corsair.cc with LCUE.dll paths');
}

async function main() {
  try {
    const skipBuild = process.argv.includes('--no-build');

    // 1. Download SDK
    console.log(`\n📦 Step 1: Download Corsair iCUE SDK v${SDK_VERSION}`);
    if (!fs.existsSync(TEMP_FILE)) {
      await downloadFile(SDK_URL, TEMP_FILE);
    } else {
      console.log('   (Using cached download)');
    }
    
    // 2. Extract SDK
    console.log(`\n📁 Step 2: Extract SDK files`);
    if (!fs.existsSync(EXTRACT_DIR)) {
      fs.mkdirSync(EXTRACT_DIR, { recursive: true });
    }
    await extractZip(TEMP_FILE, EXTRACT_DIR);
    
    // 3. Copy LCUE.dll to project
    console.log(`\n📋 Step 3: Copy SDK library to project`);
    const success = await copySDKFiles();
    
    if (!success) {
      console.error('\n❌ Failed to find LCUE.dll. You may need to:');
      console.error('   1. Download manually from: https://github.com/CorsairOfficial/cue-sdk/releases');
      console.error('   2. Extract the zip file');
      console.error('   3. Copy redist/LCUE.dll to your project root or build/Release/');
      process.exit(1);
    }
    
    // 4. Update C++ source
    console.log(`\n📝 Step 4: Update source code paths`);
    updateCorsairCC();

    if (!skipBuild) {
      // 5. Rebuild
      console.log(`\n🔨 Step 5: Rebuild native module`);
      console.log('Running: npm run build\n');
      execSync('npm run build', { stdio: 'inherit' });
    } else {
      console.log(`\n⏭️  Skipping native build (--no-build)`);
    }
    
    console.log('\n✅ Setup complete! 🎉\n');
    console.log('Next steps:');
    console.log('  1. Make sure iCUE is running');
    console.log('  2. Enable "Third-party control" in iCUE Settings → System');
    console.log('  3. Run tests: npm test');
    console.log('  4. Try the color demo: npm run colors\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nPlease install manually:');
    console.error('  1. Visit: https://github.com/CorsairOfficial/cue-sdk/releases');
    console.error('  2. Download and extract the SDK');
    console.error('  3. Copy redist/LCUE.dll to your project folder');
    console.error('  4. Run: npm run build\n');
    process.exit(1);
  }
}

main();

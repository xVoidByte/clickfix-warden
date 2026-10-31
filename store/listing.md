# Store listing texts

The same texts work for the Chrome Web Store, Edge Add-ons, Opera add-ons and Firefox Add-ons. Per-store fields are in `chrome-web-store.md`, `edge-addons.md` and `firefox-amo.md`.

## Name

ClickFix Warden

## Short description (132 characters max, Chrome and Edge)

Stops ClickFix and fake CAPTCHA attacks that trick you into running commands, and warns about sites reported as malicious.

## Summary (250 characters max, Firefox)

Stops ClickFix and fake CAPTCHA pages that trick you into pasting a command into Run, Terminal or File Explorer, and warns about sites reported as malicious. Every check runs in your browser, no data is collected.

## Description (English)

ClickFix pages pretend to be a CAPTCHA, a browser error or a Windows update. They quietly put a command in your clipboard and walk you through pressing Win+R, Ctrl+V and Enter, or pasting into Terminal or the File Explorer address bar. That one paste installs password stealers and remote access tools. It is one of the most common ways people get infected today, and antivirus often sees it too late.

ClickFix Warden stops the command before it reaches your clipboard, puts a harmless note there instead and shows you exactly what the page tried to make you run.

WHAT IT STOPS
- Fake CAPTCHA, "verify you are human", browser error and "fix it" pages that fill your clipboard
- Commands hidden behind blank space, Base64, scrambled letters or invisible characters
- The Run box, Win+X Terminal, File Explorer address bar and macOS Terminal variants
- ConsentFix pages that ask you to paste back a sign-in link with a secret code
- Links that open Script Editor or Windows search on a remote share
- Fake full-screen Windows update pages that try to lock your keyboard
- Hacked websites that load fake CAPTCHA code from a blockchain
- Known malicious extensions such as fake ad blockers, on request

REPORTED SITES
ClickFix Warden also warns you about sites, download links and servers reported in the public URLhaus, ThreatFox and Feodo Tracker databases by abuse.ch, and stops sites reported as ClickFix pages before they load. You can check your browsing history against the same database, inside your browser, whenever you want.

ALWAYS UP TO DATE
Attackers change their tricks every week. The detection rules and the database update every hour from a digitally signed source, without waiting for a new version of the extension.

PRIVATE BY DESIGN
- No account, no telemetry, no analytics, no server of its own
- Every check runs inside your browser, your browsing never leaves your computer
- The only download is the signed database and rules from GitHub
- Open source at https://github.com/xVoidByte/clickfix-warden

DOES NOT GET IN YOUR WAY
Install guides with copy buttons, support articles and everything else you copy keep working. A command is only stopped when it carries the marks of a ClickFix attack, or when the page around it tells you to paste it somewhere it should not go. You can always trust a site with one click.

FOR ORGANISATIONS
Every setting can be set and locked by policy, and you can add your own help desk message to every warning.

Remember, no real website will ever ask you to paste something into Run, Terminal or File Explorer to prove you are human.

## Description (Bulgarian)

ClickFix страниците се представят за CAPTCHA, грешка в браузъра или обновяване на Windows. Те тихо слагат команда в клипборда ви и ви водят стъпка по стъпка да натиснете Win+R, Ctrl+V и Enter или да я поставите в Terminal или в адресната лента на File Explorer. Това едно поставяне инсталира крадци на пароли и програми за отдалечен достъп. Днес това е един от най-честите начини хората да бъдат заразени, а антивирусните програми често го виждат твърде късно.

ClickFix Warden спира командата, преди да стигне до клипборда ви, слага там безобидна бележка и ви показва точно какво страницата се е опитала да ви накара да пуснете.

КАКВО СПИРА
- Фалшиви CAPTCHA, "потвърдете, че сте човек", грешки в браузъра и страници "поправи", които пълнят клипборда ви
- Команди, скрити зад празно място, Base64, разбъркани букви или невидими символи
- Вариантите с Run, Win+X Terminal, адресната лента на File Explorer и macOS Terminal
- ConsentFix страници, които искат да поставите обратно линк за вход с таен код
- Линкове, които отварят Script Editor или търсене в Windows към отдалечена папка
- Фалшиви страници за обновяване на Windows на цял екран, които се опитват да заключат клавиатурата
- Хакнати сайтове, които зареждат фалшива CAPTCHA от блокчейн
- Известни зловредни разширения, например фалшиви блокери на реклами, при поискване

ДОКЛАДВАНИ САЙТОВЕ
ClickFix Warden ви предупреждава и за сайтове, линкове за сваляне и сървъри, докладвани в публичните бази URLhaus, ThreatFox и Feodo Tracker на abuse.ch, и спира сайтове, докладвани като ClickFix страници, преди да се заредят. Можете да проверите историята си срещу същата база, във вашия браузър, когато пожелаете.

ВИНАГИ ОБНОВЕНО
Нападателите сменят номерата си всяка седмица. Правилата за засичане и базата се обновяват на всеки час от цифрово подписан източник, без да чакате нова версия на разширението.

ПОВЕРИТЕЛНОСТ ПРЕДИ ВСИЧКО
- Без акаунт, без телеметрия, без анализи, без собствен сървър
- Всяка проверка става във вашия браузър, сърфирането ви не напуска компютъра ви
- Единственото сваляне е подписаната база и правилата от GitHub
- Отворен код на https://github.com/xVoidByte/clickfix-warden

НЕ ВИ ПРЕЧИ
Ръководства за инсталиране с бутони за копиране, статии за поддръжка и всичко друго, което копирате, работят както преди. Команда се спира само когато носи белезите на ClickFix атака или когато страницата около нея ви казва да я поставите там, където не трябва. Винаги можете да се доверите на сайт с едно натискане.

ЗА ОРГАНИЗАЦИИ
Всяка настройка може да се зададе и заключи чрез политика, а във всяко предупреждение може да се добави съобщение от вашата IT поддръжка.

Запомнете, нито един истински сайт няма да ви поиска да поставите нещо в Run, Terminal или File Explorer, за да докажете, че сте човек.

## Screenshot captions

1. Stops fake CAPTCHA pages before the command reaches your clipboard
2. Shows exactly what the page tried to make you run
3. Blocks known ClickFix sites before they load
4. Warns about sites reported in public threat databases
5. Every check runs in your browser, nothing is collected

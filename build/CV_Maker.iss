#define MyAppName "CV Maker"
#ifndef MyAppVersion
#define MyAppVersion "1.0.3"
#endif
#define MyAppPublisher "Farouk"
#define MyAppURL "https://www.damergi.com"
#define MyAppExeName "CV Maker.exe"
#define MyProjectProgId "CVM.Project"
[Setup]
AppId={{D2B75E12-7FB5-47DE-9A46-2DA3F91B0E50}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL=https://github.com/dafarouk/CV-Maker/releases
DefaultDirName={autopf}\CV Maker
DefaultGroupName=CV Maker
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
AllowNoIcons=yes
OutputDir=installer
OutputBaseFilename=CV-Maker-Setup-{#MyAppVersion}
SetupIconFile=..\assets\branding\cvm_app.ico
WizardImageFile=..\assets\setup\cvm_setup_wizard.bmp
WizardSmallImageFile=..\assets\setup\cvm_setup_small.bmp
WizardImageBackColor=$121720
WizardSmallImageBackColor=$121720
WizardStyle=modern
WizardResizable=yes
WizardSizePercent=110
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ChangesAssociations=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName=CV Maker
CloseApplications=yes
RestartApplications=no
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"; InfoBeforeFile: "README-FIRST.en.txt"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"; InfoBeforeFile: "README-FIRST.fr.txt"
[Messages]
english.WelcomeLabel1=Welcome to CV Maker Setup
english.WelcomeLabel2=CV Maker by Farouk is free software for creating professional CVs.%n%nYour CV data stays on your computer by default.%n%nClick Next to continue.
french.WelcomeLabel1=Bienvenue dans l'installation de CV Maker
french.WelcomeLabel2=CV Maker par Farouk est un logiciel gratuit pour créer des CV professionnels.%n%nVos données restent sur votre ordinateur par défaut.%n%nCliquez sur Suivant pour continuer.
[CustomMessages]
english.AdditionalTasks=Additional options:
french.AdditionalTasks=Options supplémentaires :
english.CreateStartMenuIcon=Create a &Start Menu shortcut
french.CreateStartMenuIcon=Créer un raccourci dans le menu &Démarrer
english.AssociateCvm=&Associate .cvm files with CV Maker
french.AssociateCvm=&Associer les fichiers .cvm à CV Maker
[Tasks]
Name: "startmenuicon"; Description: "{cm:CreateStartMenuIcon}"; GroupDescription: "{cm:AdditionalTasks}"
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalTasks}"; Flags: unchecked
Name: "fileassoc"; Description: "{cm:AssociateCvm}"; GroupDescription: "{cm:AdditionalTasks}"
[Dirs]
Name: "{localappdata}\Farouk\CV Maker\projects"; Flags: uninsneveruninstall
Name: "{localappdata}\Farouk\CV Maker\autosave"; Flags: uninsneveruninstall
Name: "{localappdata}\Farouk\CV Maker\settings"; Flags: uninsneveruninstall
Name: "{localappdata}\Farouk\CV Maker\logs"; Flags: uninsneveruninstall
Name: "{userdocs}\CVM Exports"; Flags: uninsneveruninstall

[Files]
Source: "..\dist\CV Maker\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\CV Maker"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: startmenuicon
Name: "{autodesktop}\CV Maker"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
[Registry]
Root: HKCU; Subkey: "Software\Classes\.cvm"; ValueType: string; ValueData: "{#MyProjectProgId}"; Flags: uninsdeletevalue; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\{#MyProjectProgId}"; ValueType: string; ValueData: "CV Maker Project"; Flags: uninsdeletekey; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\{#MyProjectProgId}\DefaultIcon"; ValueType: string; ValueData: "{app}\{#MyAppExeName},0"; Tasks: fileassoc
Root: HKCU; Subkey: "Software\Classes\{#MyProjectProgId}\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: fileassoc
[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,CV Maker}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Flags: nowait; Check: WizardSilent

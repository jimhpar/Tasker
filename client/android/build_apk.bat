@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=C:\Users\Zim\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0"
echo Starting Gradle build for Tasker Android APK...
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo Build failed with error %errorlevel%
    exit /b %errorlevel%
)
if not exist "..\..\release" mkdir "..\..\release"
copy /y "app\build\outputs\apk\debug\app-debug.apk" "..\..\release\Tasker.apk" >nul
copy /y "app\build\outputs\apk\debug\app-debug.apk" "..\..\release\Tasker-v2.1.0.apk" >nul
echo Build completed successfully! APK saved to release\Tasker.apk

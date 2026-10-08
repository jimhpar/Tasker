@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=C:\Users\Zim\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0"
echo Starting Gradle build for Tasker Android Signed Release APK...
call gradlew.bat assembleRelease
if %errorlevel% neq 0 (
    echo Build failed with error %errorlevel%
    exit /b %errorlevel%
)
if not exist "..\..\release" mkdir "..\..\release"
copy /y "app\build\outputs\apk\release\app-release.apk" "..\..\release\Tasker.apk" >nul
copy /y "app\build\outputs\apk\release\app-release.apk" "..\..\release\Tasker-v3.4.2.apk" >nul
if exist "..\..\Tasker*.apk" del /f /q "..\..\Tasker*.apk"
echo Build completed successfully! Signed APK saved to release\Tasker-v3.4.2.apk

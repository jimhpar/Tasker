!macro customInstall
  ; Enable startup on system boot by default in HKCU Run registry
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Tasker" '"$INSTDIR\Tasker.exe" --autostart'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Tasker"
!macroend

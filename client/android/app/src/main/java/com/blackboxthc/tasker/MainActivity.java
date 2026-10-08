package com.blackboxthc.tasker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        requestNotificationPermissionNative();
    }

    private void requestNotificationPermissionNative() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            long[] vibrationPattern = new long[]{0, 250, 150, 250};
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

            // 1. Tasker Messages Channel (Chat - Heads-Up Banner, Lock Screen, Badge & Sound)
            NotificationChannel messagesChannel = new NotificationChannel(
                "tasker_messages",
                "Tasker Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            messagesChannel.setDescription("Direct and team chat notifications");
            messagesChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            messagesChannel.setShowBadge(true);
            messagesChannel.enableLights(true);
            messagesChannel.setLightColor(Color.BLUE);
            messagesChannel.enableVibration(true);
            messagesChannel.setVibrationPattern(vibrationPattern);
            messagesChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(messagesChannel);

            // 2. Tasker Tasks Channel (Task Reminders & Deadlines)
            NotificationChannel tasksChannel = new NotificationChannel(
                "tasker_tasks",
                "Tasker Task Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            tasksChannel.setDescription("Task alerts, start time reminders, and deadline notifications");
            tasksChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            tasksChannel.setShowBadge(true);
            tasksChannel.enableLights(true);
            tasksChannel.setLightColor(Color.MAGENTA);
            tasksChannel.enableVibration(true);
            tasksChannel.setVibrationPattern(vibrationPattern);
            tasksChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(tasksChannel);

            // 3. Tasker General & AI Alerts Channel
            NotificationChannel alertsChannel = new NotificationChannel(
                "tasker_alerts",
                "Tasker System & AI Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertsChannel.setDescription("System announcements and AI time management alerts");
            alertsChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            alertsChannel.setShowBadge(true);
            alertsChannel.enableLights(true);
            alertsChannel.enableVibration(true);
            alertsChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(alertsChannel);

            // 4. Default Channel fallback
            NotificationChannel defaultChannel = new NotificationChannel(
                "default",
                "Default Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            defaultChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            defaultChannel.setShowBadge(true);
            defaultChannel.enableLights(true);
            defaultChannel.enableVibration(true);
            defaultChannel.setSound(soundUri, audioAttributes);
            manager.createNotificationChannel(defaultChannel);
        }
    }
}

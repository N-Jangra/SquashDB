package com.squashdb.tracker;

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Android bakes a launcher icon+label into each activity-alias at build time, so an
// icon and a name can only be switched live by enabling one pre-declared alias out of
// a fixed set and disabling the rest (see AndroidManifest.xml: Look_<icon>_<nameIndex>).
// To let icon and name be chosen independently without reverting each other, every
// icon x name combination is pre-baked as its own alias.
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    // Must match the icon keys used in AndroidManifest.xml alias names (Look_<icon>_<index>)
    private static final String[] ICON_KEYS = {
        "classic",
        "turquoise",
        "orange",
        "pink",
        "bentogrid",
        "glassimpact",
        "playstack",
        "progressring",
        "vault",
        "orbithub",
        "progressvault",
        "timelinepulse"
    };

    // Number of name presets per icon (must match the count baked into AndroidManifest.xml)
    private static final int NAME_COUNT = 16;

    // Index of the name enabled by default (Look_turquoise_10 = "SquashDB")
    private static final int DEFAULT_NAME_INDEX = 10;

    // Must match the icon key of the alias with android:enabled="true" in AndroidManifest.xml
    private static final String DEFAULT_ICON_KEY = "turquoise";

    private String aliasName(String iconKey, int nameIndex) {
        return "Look_" + iconKey + "_" + nameIndex;
    }

    private boolean isValidIconKey(String iconKey) {
        for (String key : ICON_KEYS) {
            if (key.equals(iconKey)) return true;
        }
        return false;
    }

    @PluginMethod
    public void setLook(PluginCall call) {
        String iconKey = call.getString("icon");
        Integer nameIndex = call.getInt("nameIndex");

        if (iconKey == null || !isValidIconKey(iconKey)) {
            call.reject("Invalid or missing 'icon' parameter");
            return;
        }
        if (nameIndex == null || nameIndex < 0 || nameIndex >= NAME_COUNT) {
            call.reject("Invalid or missing 'nameIndex' parameter");
            return;
        }

        String targetAlias = aliasName(iconKey, nameIndex);
        PackageManager pm = getContext().getPackageManager();
        String packageName = getContext().getPackageName();

        for (String key : ICON_KEYS) {
            for (int i = 0; i < NAME_COUNT; i++) {
                String alias = aliasName(key, i);
                ComponentName component = new ComponentName(packageName, packageName + "." + alias);
                int newState = alias.equals(targetAlias)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                pm.setComponentEnabledSetting(component, newState, PackageManager.DONT_KILL_APP);
            }
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("icon", iconKey);
        result.put("nameIndex", nameIndex);
        call.resolve(result);
    }

    @PluginMethod
    public void getLook(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String packageName = getContext().getPackageName();
        // Must match the alias enabled by default in AndroidManifest.xml (Look_turquoise_10 = "SquashDB")
        String activeIcon = DEFAULT_ICON_KEY;
        int activeNameIndex = DEFAULT_NAME_INDEX;

        outer:
        for (String key : ICON_KEYS) {
            for (int i = 0; i < NAME_COUNT; i++) {
                String alias = aliasName(key, i);
                ComponentName component = new ComponentName(packageName, packageName + "." + alias);
                int state = pm.getComponentEnabledSetting(component);
                boolean enabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && key.equals(DEFAULT_ICON_KEY) && i == DEFAULT_NAME_INDEX);
                if (enabled) {
                    activeIcon = key;
                    activeNameIndex = i;
                    break outer;
                }
            }
        }

        JSObject result = new JSObject();
        result.put("icon", activeIcon);
        result.put("nameIndex", activeNameIndex);
        call.resolve(result);
    }
}

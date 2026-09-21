package com.squashdb.tracker;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {
    @PluginMethod
    public void isAvailable(PluginCall call) {
        int result = BiometricManager.from(getContext()).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL
        );
        JSObject response = new JSObject();
        response.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        response.put("code", result);
        call.resolve(response);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Biometric authentication requires a FragmentActivity");
            return;
        }

        String reason = call.getString("reason", "Unlock SquashDB");
        FragmentActivity activity = (FragmentActivity) getActivity();
        BiometricPrompt prompt = new BiometricPrompt(activity,
            ContextCompat.getMainExecutor(activity),
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    JSObject response = new JSObject();
                    response.put("success", true);
                    call.resolve(response);
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    call.reject(errString == null ? "Authentication failed" : errString.toString());
                }

                @Override
                public void onAuthenticationFailed() {
                    // The system prompt remains open for retry; resolve/reject only
                    // when Android reports success or a terminal error.
                }
            }
        );
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock SquashDB")
            .setSubtitle(reason)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build();
        prompt.authenticate(info);
    }
}

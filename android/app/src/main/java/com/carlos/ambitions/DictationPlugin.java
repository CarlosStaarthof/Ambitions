package com.carlos.ambitions;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * Phone speech-to-text for block notes. Returns a transcript as text and never
 * writes audio anywhere: the platform recognizer owns the microphone session and
 * the result is a string. RECORD_AUDIO is requested the first time the microphone
 * is tapped, not at launch.
 */
@CapacitorPlugin(
    name = "Dictation",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class DictationPlugin extends Plugin {

    private SpeechRecognizer recognizer;
    private PluginCall pending;

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneCallback");
            return;
        }
        listen(call);
    }

    @PermissionCallback
    private void microphoneCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            listen(call);
        } else {
            JSObject ret = new JSObject();
            ret.put("error", "dictation-denied");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        finish(null, "dictation-no-speech");
        call.resolve();
    }

    private void listen(final PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            JSObject ret = new JSObject();
            ret.put("error", "dictation-unsupported");
            call.resolve(ret);
            return;
        }
        if (pending != null) finish(null, "dictation-no-speech");
        pending = call;
        getActivity().runOnUiThread(() -> {
            destroyRecognizer();
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(listener);
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            recognizer.startListening(intent);
        });
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}
        @Override public void onPartialResults(Bundle partialResults) {}

        @Override
        public void onError(int error) {
            if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                finish(null, "dictation-denied");
            } else if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                finish(null, "dictation-no-speech");
            } else {
                finish(null, "dictation-unsupported");
            }
        }

        @Override
        public void onResults(Bundle results) {
            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            String text = matches != null && !matches.isEmpty() ? matches.get(0) : "";
            if (text == null || text.trim().isEmpty()) finish(null, "dictation-no-speech");
            else finish(text, null);
        }
    };

    private void finish(String text, String error) {
        PluginCall call = pending;
        pending = null;
        destroyRecognizer();
        if (call == null) return;
        JSObject ret = new JSObject();
        if (error != null) ret.put("error", error);
        else ret.put("text", text == null ? "" : text);
        call.resolve(ret);
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            try { recognizer.stopListening(); } catch (Exception ignored) { }
            try { recognizer.cancel(); } catch (Exception ignored) { }
            try { recognizer.destroy(); } catch (Exception ignored) { }
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        finish(null, "dictation-no-speech");
        super.handleOnDestroy();
    }
}

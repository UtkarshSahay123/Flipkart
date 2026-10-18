package com.roadguard.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final int GEO_PERMISSION_REQUEST = 2001;
    private static final int WEB_PERMISSION_REQUEST = 2002;
    private static final String APP_URL = "https://flipkart-06iz.onrender.com/webapp/";
    private static final String RENDER_HOST = "flipkart-06iz.onrender.com";
    private static final String VERCEL_HOST = "flipkart-xi-blue.vercel.app";

    private WebView webView;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;
    private PermissionRequest pendingWebPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xFF003D9B);
        getWindow().setNavigationBarColor(0xFF003D9B);

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setTextZoom(100);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript("(function(){"
                        + "function fitRoadGuardContent(){try{"
                        + "var frame=document.querySelector('iframe');"
                        + "var doc=frame&&frame.contentDocument;"
                        + "if(!doc||!doc.head)return;"
                        + "var style=doc.getElementById('roadguard-android-responsive-layout');"
                        + "if(!style){style=doc.createElement('style');style.id='roadguard-android-responsive-layout';doc.head.appendChild(style);}"
                        + "style.textContent='*,*::before,*::after{box-sizing:border-box!important}'"
                        + "+'html,body{width:100%!important;max-width:100vw!important;overflow-x:hidden!important}'"
                        + "+'img,video,canvas,svg,iframe{max-width:100%}'"
                        + "+'@media(max-width:767px){body{min-width:0!important}'"
                        + "+'#root,#root>div{min-width:0!important;max-width:100vw!important}'"
                        + "+'header,header>div,main{width:100%!important;max-width:100vw!important;min-width:0!important}'"
                        + "+'header>div,main{padding-left:12px!important;padding-right:12px!important}'"
                        + "+'header nav{width:100%!important;max-width:100%!important;flex-wrap:wrap!important;justify-content:center!important;gap:8px!important}'"
                        + "+'header nav a{white-space:normal!important;text-align:center!important}'"
                        + "+'main>* ,main section,main article,main form{min-width:0!important;max-width:100%!important}'"
                        + "+'main .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))!important}'"
                        + "+'main .flex{min-width:0!important;flex-wrap:wrap!important}'"
                        + "+'main .flex>*{min-width:0!important;max-width:100%!important}'"
                        + "+'main table{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important}'"
                        + "+'main input,main select,main textarea,main button{max-width:100%!important}'"
                        + "+'[role=dialog]{width:auto!important;max-width:calc(100vw - 24px)!important}'"
                        + "+'.leaflet-container{width:100%!important;max-width:100%!important}}';"
                        + "}catch(e){}}"
                        + "fitRoadGuardContent();window.addEventListener('resize',fitRoadGuardContent);"
                        + "var frame=document.querySelector('iframe');if(frame)frame.addEventListener('load',fitRoadGuardContent);"
                        + "})();", null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.equalsIgnoreCase(RENDER_HOST)
                        || host.equalsIgnoreCase(VERCEL_HOST))) {
                    return false;
                }
                if ("https".equalsIgnoreCase(uri.getScheme()) || "mailto".equalsIgnoreCase(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                        // Keep unsupported external links inside the app's current page.
                    }
                    return true;
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, true);
                    return;
                }
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                requestPermissions(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                }, GEO_PERMISSION_REQUEST);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermissionRequest(request));
            }
        });

        setContentView(webView);
        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        List<String> required = new ArrayList<>();
        List<String> grantable = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                required.add(Manifest.permission.CAMERA);
                grantable.add(resource);
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                required.add(Manifest.permission.RECORD_AUDIO);
                grantable.add(resource);
            }
        }
        if (grantable.isEmpty()) {
            request.deny();
            return;
        }

        boolean allGranted = true;
        for (String permission : required) {
            if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }
        if (allGranted) {
            request.grant(grantable.toArray(new String[0]));
        } else {
            pendingWebPermission = request;
            requestPermissions(required.toArray(new String[0]), WEB_PERMISSION_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == GEO_PERMISSION_REQUEST && pendingGeoCallback != null) {
            pendingGeoCallback.invoke(pendingGeoOrigin, hasLocationPermission(), false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
        } else if (requestCode == WEB_PERMISSION_REQUEST && pendingWebPermission != null) {
            boolean granted = grantResults.length > 0;
            for (int result : grantResults) granted &= result == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                List<String> resources = new ArrayList<>();
                for (String resource : pendingWebPermission.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                            && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        resources.add(resource);
                    } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                            && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        resources.add(resource);
                    }
                }
                if (resources.isEmpty()) pendingWebPermission.deny();
                else pendingWebPermission.grant(resources.toArray(new String[0]));
            } else {
                pendingWebPermission.deny();
            }
            pendingWebPermission = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}

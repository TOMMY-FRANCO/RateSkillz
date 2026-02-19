package com.ratingskill.app;

import android.app.Activity;
import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.AcknowledgePurchaseResponseListener;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "BillingPlugin";

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        Context context = getContext();
        billingClient = BillingClient.newBuilder(context)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
    }

    private void connectBillingClient(Runnable onConnected, Runnable onFailed) {
        if (billingClient.isReady()) {
            onConnected.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onConnected.run();
                } else {
                    Log.e(TAG, "Billing setup failed: " + billingResult.getDebugMessage());
                    onFailed.run();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                Log.w(TAG, "Billing service disconnected");
            }
        });
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        connectBillingClient(
                () -> {
                    JSObject result = new JSObject();
                    result.put("available", true);
                    call.resolve(result);
                },
                () -> {
                    JSObject result = new JSObject();
                    result.put("available", false);
                    call.resolve(result);
                }
        );
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null || productId.isEmpty()) {
            call.reject("productId is required");
            return;
        }

        pendingPurchaseCall = call;

        connectBillingClient(
                () -> queryProductAndLaunchBilling(productId),
                () -> {
                    pendingPurchaseCall = null;
                    call.reject("Billing service unavailable");
                }
        );
    }

    private void queryProductAndLaunchBilling(String productId) {
        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        productList.add(
                QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
        );

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.e(TAG, "Failed to query product: " + billingResult.getDebugMessage());
                if (pendingPurchaseCall != null) {
                    pendingPurchaseCall.reject("Failed to query product details: " + billingResult.getDebugMessage());
                    pendingPurchaseCall = null;
                }
                return;
            }

            if (productDetailsList == null || productDetailsList.isEmpty()) {
                Log.e(TAG, "No product details found for: " + productId);
                if (pendingPurchaseCall != null) {
                    pendingPurchaseCall.reject("Product not found in Google Play: " + productId);
                    pendingPurchaseCall = null;
                }
                return;
            }

            ProductDetails productDetails = productDetailsList.get(0);

            List<BillingFlowParams.ProductDetailsParams> productDetailsParamsList = new ArrayList<>();
            productDetailsParamsList.add(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)
                            .build()
            );

            BillingFlowParams billingFlowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(productDetailsParamsList)
                    .build();

            Activity activity = getActivity();
            if (activity == null) {
                if (pendingPurchaseCall != null) {
                    pendingPurchaseCall.reject("Activity not available");
                    pendingPurchaseCall = null;
                }
                return;
            }

            BillingResult launchResult = billingClient.launchBillingFlow(activity, billingFlowParams);
            if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                Log.e(TAG, "Failed to launch billing flow: " + launchResult.getDebugMessage());
                if (pendingPurchaseCall != null) {
                    pendingPurchaseCall.reject("Failed to launch payment: " + launchResult.getDebugMessage());
                    pendingPurchaseCall = null;
                }
            }
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        if (pendingPurchaseCall == null) {
            return;
        }

        int responseCode = billingResult.getResponseCode();

        if (responseCode == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            Purchase purchase = purchases.get(0);
            JSObject result = new JSObject();
            result.put("purchaseToken", purchase.getPurchaseToken());
            result.put("orderId", purchase.getOrderId());
            result.put("productId", purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0));
            result.put("purchaseState", purchase.getPurchaseState());
            pendingPurchaseCall.resolve(result);
            pendingPurchaseCall = null;
        } else if (responseCode == BillingClient.BillingResponseCode.USER_CANCELED) {
            pendingPurchaseCall.reject("Purchase cancelled");
            pendingPurchaseCall = null;
        } else {
            pendingPurchaseCall.reject("Purchase failed: " + billingResult.getDebugMessage());
            pendingPurchaseCall = null;
        }
    }

    @PluginMethod
    public void acknowledgePurchase(PluginCall call) {
        String purchaseToken = call.getString("purchaseToken");
        if (purchaseToken == null || purchaseToken.isEmpty()) {
            call.reject("purchaseToken is required");
            return;
        }

        connectBillingClient(
                () -> {
                    AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchaseToken)
                            .build();

                    billingClient.acknowledgePurchase(params, billingResult -> {
                        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                            JSObject result = new JSObject();
                            result.put("success", true);
                            call.resolve(result);
                        } else {
                            call.reject("Failed to acknowledge purchase: " + billingResult.getDebugMessage());
                        }
                    });
                },
                () -> call.reject("Billing service unavailable")
        );
    }
}

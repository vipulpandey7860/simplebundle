import React, { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import { useActionData, useSubmit, useNavigation } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import ResourceUI from "../components/ResourceUI";
import { Spinner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { sendSupportSlackNotification } from "../sendSlackNotification.server";
import i18next from "i18next";

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const email = formData.get("email");
  const message = formData.get("message");
  const requestType = formData.get("requestType");
  const timestamp = new Date().toISOString();
  const shopDomain = session.shop;

  try {
    const result = await sendSupportSlackNotification({
      email,
      message,
      requestType,
      timestamp,
      shopDomain,
    });

    if (result.ok) {
      return json({ success: true });
    } else {
      throw new Error(
        result.error || "Failed to submit support request please try again..",
      );
    }
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export default function Resources() {
  const app = useAppBridge();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shouldResetForm, setShouldResetForm] = useState(false);

  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        app.toast.show("Support request sent successfully");
        setIsModalOpen(false);
        setShouldResetForm(true);
      } else if (actionData.error) {
        app.toast.show("Failed to send support request: " + actionData.error, {
          isError: true,
        });
      }
      setIsSubmitting(false);
    }
  }, [actionData, app]);

  const handleSupportSubmit = (formData) => {
    setIsSubmitting(true);
    setShouldResetForm(false);
    submit(formData, { method: "post" });
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
    setShouldResetForm(false);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setShouldResetForm(true);
  };

  return (
    <>
      {navigation.state === "loading" ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <Spinner accessibilityLabel="Loading" size="large" />
        </div>
      ) : (
        <ResourceUI
          onSupportSubmit={handleSupportSubmit}
          formErrors={actionData?.errors}
          isSubmitting={isSubmitting}
          isModalOpen={isModalOpen}
          onModalOpen={handleModalOpen}
          onModalClose={handleModalClose}
          shouldResetForm={shouldResetForm}
          i18={i18next}
        />
      )}
       <script src="//code.tidio.co/oma6jmieabziumphilootw8fmtsdorad.js" async></script>
    </>
  );
}

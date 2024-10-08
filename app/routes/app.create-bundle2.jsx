import{ useMemo, useEffect, useState, useCallback } from "react"; 
import { ChevronLeftIcon, ChevronRightIcon } from "@shopify/polaris-icons";
import {json} from "@remix-run/node";
import {
    Page,
    Card,
    Icon,
    BlockStack,
    InlineStack,
    Text,
    Spinner,
    Button
  } from "@shopify/polaris";
  import {
    useSubmit, useNavigation, useActionData, useNavigate
  } from "@remix-run/react";
  import { authenticate } from "../shopify.server";
  import { CREATE_PRODUCT_STATUS } from "../api/CREATE_PRODUCT_STATUS";
  import { PUBLISH_PRODUCT } from "../api/PUBLISH_PRODUCT";
  import InfiniteStep1 from "../components/InfiniteStep1";
  import InfiniteStep2 from "../components/InfiniteStep2";
  import { useAppBridge } from "@shopify/app-bridge-react";
  import prisma from "../db.server";
  import TwoColumnLayoutTwo from '../components/TwoColumnTwo';
  import {BundleWarningTwo} from "../components/BundleWarningTwo";
  import { FETCH_PUBLICATIONS } from "../api/FETCH_PUBLICATIONS";
  import i18next from "i18next";

  export async function action({request}) {
    const body = await request.formData();
    const bundleData = JSON.parse(body.get('formData'));
    console.log("This is the form data: ",bundleData);
    const bundleStatus = bundleData.status.toUpperCase();
    const { admin, session } = await authenticate.admin(request);
    const response = await admin.graphql(CREATE_PRODUCT_STATUS,{
            variables: {
                "input": {
                    "title": bundleData.bundleName,
                    "status": bundleStatus
                }
            }
        }
      );
      const result = await response.json();
      const data = result.data;
    const response3 = await admin.graphql(FETCH_PUBLICATIONS);
      const data2 = await response3.json();
      const id = data2.data.publications.edges.filter(edge => edge.node.name === "Online Store").map(edge => edge.node.id);
       await admin.graphql(PUBLISH_PRODUCT,{
          variables:{
            "id":  data.productCreate.product.id,
            "input": {
              "publicationId": id[0]
            }
          }
      })
      const offerData = {
        ProductBundleId: data.productCreate.product.id,
        ProductHandle: null,
        bundleName: bundleData.bundleName,
        description: null,
        discountType: null,
        discountValue: null,
        products: bundleData.productOptions,
        bundleType:"infinite",
        userId: session.id,
      };
      await prisma.bundle.create({ data: offerData });
      const operation = Object.keys(data)[0];
      const errors = data[operation].userErrors;

  if (errors && errors.length > 0) {
    throw new Error(`Error creating product bundle: ${JSON.stringify(errors)}`);
  }
  else{
    return json({success: true});
  }
     
    
  }  
export default function CreateComplexBundle() {
    const actionSuccess = useActionData();
    const navigation = useNavigation();
    const navigate = useNavigate();
    const app = useAppBridge();
    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState({});
    const [showBundleWarning, setShowBundleWarning] = useState(true);
    const initialFormData = useMemo(
        () => ({
          bundleName: "",
          status: "draft",
          productOptions: [],
        }),
        [],
      );
      const [formData, setFormData] = useState(initialFormData);  

      useEffect(() => {
        if (actionSuccess?.success) {
          app.toast.show('Bundle created successfully');
          const redirectTimer = setTimeout(() => {
            navigate("/app");
          }, 3000);
          return () => clearTimeout(redirectTimer);
        }
      }, [actionSuccess,app,navigate]);

      const handleChange = useCallback( (field) => (value)=>{
        setFormData((prev) => ({ ...prev, [field]: value }));
      },[]);
      const submit = useSubmit();
      const handlePreviousStep = useCallback(()=>{
        setCurrentStep(1);
      },[])

      const handleProductOptionsChange = useCallback((newProductOptions) => {
        setFormData((prev) => ({ ...prev, productOptions: newProductOptions }));
      }, []);
      const validateStep = useCallback(() => {
        const newErrors = {};
        let invalidNames = [];
        switch (currentStep) {
          case 1:
            if (!formData.bundleName.trim())
              newErrors.bundleName = "Bundle name is required";
            break;
            case 2:
              if (formData.productOptions.length === 0) {
                newErrors.products = "At least one product must be added to the bundle";
              } else {
                invalidNames = formData.productOptions.filter(option => {
                  if ('name' in option) {
                    return !option.name.trim();
                  } else if (option.product && option.product.options) {
                    return option.product.options.some(productOption => !productOption.name.trim());
                  }
                  return false;
                });
        
                if (invalidNames.length > 0) {
                  newErrors.productNames = "All product options must have a name";
                }
              }
              break;
        }
        setErrors(prevErrors => {
          const updatedErrors = { ...prevErrors };
          
          // Remove errors that have been fixed
          if (currentStep === 1 && formData.bundleName.trim()) {
            delete updatedErrors.bundleName;
          }
          if (currentStep === 2) {
            if (formData.productOptions.length > 0) {
              delete updatedErrors.products;
            }
            if (invalidNames.length === 0) {
              delete updatedErrors.productNames;
            }
          }
      
          // Add new errors
          const finalErrors = { ...updatedErrors, ...newErrors };
      
          // If there are any errors, scroll to the top of the page
          if (Object.keys(finalErrors).length > 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
      
          return finalErrors;
        });
      
        return Object.keys(newErrors).length === 0;
      }, [formData, currentStep]);
      const handleSubmit = useCallback( () =>{
        if(validateStep()){
          setCurrentStep(2);
          }
      },[validateStep]);
      const handleFinalSubmit = useCallback(() => {
        if(validateStep()){
        const formDataSend = new FormData();
        formDataSend.append("formData", JSON.stringify(formData));
        submit(formDataSend, {
          method: "post",
          encType: "multipart/form-data",
        });
      }
      },[validateStep, formData, submit]); 

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <InfiniteStep1
          formData={formData} 
          handleChange={handleChange} 
          isSubmitting={navigation.state === "submitting"}
          errors={errors}
          i18={i18next}
          />
        );
      case 2:
        return (
          <InfiniteStep2 app={app}
           formData={formData}
           onProductOptionsChange={handleProductOptionsChange}
           errors={errors}
           i18={i18next}
            />
        );
      default:
        return null;
    }
  };

  return (
    <Page fullWidth>
       {navigation.state === "loading" ? ( 
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spinner accessibilityLabel="Loading" size="large" />
      </div>
       ):
     (
       <BlockStack gap="800">
         <BundleWarningTwo
          showBanner={showBundleWarning}
          setShowBanner={setShowBundleWarning}
          i18={i18next}
        />
      <BlockStack gap="800">
       
          <BlockStack gap="500">
            <TwoColumnLayoutTwo i18={i18next} step={currentStep}>
              <BlockStack gap="600">
              {renderStep()}
              <Card>
              <InlineStack align="space-between">
              <div>
                      {currentStep > 1 && (
                        <Button onClick={handlePreviousStep}>
                          <InlineStack gap="200">
                            <Icon source={ChevronLeftIcon} />
                            <Text>{i18next.t("bundleInfinitePrev")}</Text>
                          </InlineStack>
                        </Button>
                      )}
                    </div>
                    <div>
                      {currentStep < 2 ? (
                        <Button onClick={handleSubmit} primary
                          disabled={currentStep === 2}
                        >
                          <InlineStack gap="200">
                            <Text>{i18next.t("nextBtn")}</Text>
                            <Icon source={ChevronRightIcon} />
                            
                          </InlineStack>
                        </Button>
                      ) : (
                        <InlineStack gap="200">
                          <Button
                            onClick={handleFinalSubmit}
                            variant="primary"
                            loading={navigation.state === "submitting"}
                          >
                            {i18next.t("pitchBtn2")}
                          </Button>
                        </InlineStack>
                      )}
                    </div>
              </InlineStack>
              </Card>
              </BlockStack>
            </TwoColumnLayoutTwo>
          </BlockStack>
       
      </BlockStack>
      </BlockStack>
     )}
       <script src="//code.tidio.co/oma6jmieabziumphilootw8fmtsdorad.js" async></script>
    </Page>
  )
}

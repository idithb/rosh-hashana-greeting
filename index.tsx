import { GoogleGenAI } from "@google/genai";

// --- State Variables ---
let uploadedImageBase64: string | null = null;
let uploadedImageType: string | null = null;
let selectedStyle: string | null = null;

// --- DOM Element Selection ---
const uploadView = document.getElementById('upload-view') as HTMLDivElement;
const loadingView = document.getElementById('loading-view') as HTMLDivElement;
const resultView = document.getElementById('result-view') as HTMLDivElement;

const fileUpload = document.getElementById('file-upload') as HTMLInputElement;
const imagePreviewContainer = document.getElementById('image-preview-container') as HTMLDivElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const uploadText = document.getElementById('upload-text') as HTMLSpanElement;

const styleSelection = document.getElementById('style-selection') as HTMLDivElement;
const styleOptions = document.querySelectorAll('.style-option') as NodeListOf<HTMLButtonElement>;

const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const downloadButton = document.getElementById('download-button') as HTMLButtonElement;
const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;

// --- Helper Functions ---

/**
 * Shows a specific view ('upload', 'loading', or 'result') and hides the others.
 */
const showView = (viewToShow: 'upload' | 'loading' | 'result') => {
    uploadView.classList.add('hidden');
    loadingView.classList.add('hidden');
    resultView.classList.add('hidden');

    const viewMap = {
        upload: uploadView,
        loading: loadingView,
        result: resultView,
    };
    viewMap[viewToShow]?.classList.remove('hidden');
};

/**
 * Enables or disables the 'Generate' button based on whether an image and style are selected.
 */
const updateGenerateButtonState = () => {
    generateButton.disabled = !(uploadedImageBase64 && selectedStyle);
};

/**
 * Converts a File object to a Base64 encoded string, stripping the data URL prefix.
 */
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as Base64 string.'));
            }
        };
        reader.onerror = error => reject(error);
    });
};

// --- Event Listener Setup ---

/**
 * Handles file selection: reads the file, updates the preview, and reveals next steps.
 */
fileUpload.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
        try {
            uploadedImageType = file.type;
            uploadedImageBase64 = await fileToBase64(file);

            imagePreview.src = `data:${uploadedImageType};base64,${uploadedImageBase64}`;
            imagePreviewContainer.classList.remove('hidden');
            styleSelection.classList.remove('hidden');
            generateButton.classList.remove('hidden');
            uploadText.textContent = 'החליפו תמונה';

            updateGenerateButtonState();
        } catch (error) {
            console.error("Error processing file:", error);
            alert("שגיאה בעיבוד התמונה. אנא נסו קובץ אחר.");
        }
    }
});

/**
 * Handles style selection: updates UI to show selection and updates internal state.
 */
styleOptions.forEach(button => {
    button.addEventListener('click', () => {
        styleOptions.forEach(opt => opt.classList.remove('selected'));
        button.classList.add('selected');
        selectedStyle = button.dataset.style || null;
        updateGenerateButtonState();
    });
});

/**
 * Handles the main generation logic on button click.
 */
generateButton.addEventListener('click', async () => {
    if (!uploadedImageBase64 || !selectedStyle || !uploadedImageType) {
        alert("אנא העלו תמונה ובחרו סגנון מסגרת.");
        return;
    }

    showView('loading');

    const stylePrompts: { [key: string]: string } = {
        childish: 'in a cute, colorful, and childish drawing style with fun illustrations',
        festive: 'in a luxurious and festive style with elegant gold elements, flowers, and pomegranates',
        natural: 'in a natural, organic style using leaves, flowers, and fruits',
        nostalgic: 'with a nostalgic, vintage postcard look using pastel colors'
    };
    
    const specificPrompt = stylePrompts[selectedStyle] || 'in a festive style';
    const basePrompt = `Create a beautiful, decorative frame around the provided image for the Jewish New Year (Rosh Hashanah). It is crucial that the original image remains completely unchanged. The frame should seamlessly integrate with the image ${specificPrompt}. Do not add any text, greetings, or letters to the image or the frame.`;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    { inlineData: { data: uploadedImageBase64, mimeType: uploadedImageType } },
                    { text: basePrompt },
                ],
            },
            config: {
                responseModalities: ["IMAGE", "TEXT"],
            },
        });
        
        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart?.inlineData) {
            const { data, mimeType } = imagePart.inlineData;
            resultImage.src = `data:${mimeType};base64,${data}`;
            showView('result');
        } else {
            throw new Error("לא התקבלה תמונה מהמודל. ייתכן שהבקשה נדחתה. נסו שוב.");
        }
    } catch (error: any) {
        console.error("Error generating image:", error);
        alert(`שגיאה ביצירת התמונה:\n${error.message || 'אירעה שגיאה לא צפויה.'}`);
        showView('upload');
    }
});

/**
 * Handles downloading the generated card by composing the image and text on a canvas.
 */
downloadButton.addEventListener('click', () => {
    // Create an in-memory image element to properly load the generated image
    // This is crucial for drawing it onto the canvas without issues.
    const image = new Image();
    image.onload = () => {
        // Create a canvas to compose the final image with text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            alert("לא ניתן היה ליצור את התמונה להורדה.");
            return;
        }

        // --- Define styling for the text ---
        // These values are chosen to approximate the look from the CSS
        const FONT_SIZE = Math.max(40, image.naturalWidth / 12); // Proportional font size
        const BOTTOM_PADDING = FONT_SIZE * 1.5; // Padding below image for text
        const FONT_FAMILY = '"Noto Serif Hebrew", serif';
        const FONT_WEIGHT = '600';
        const TEXT_COLOR = '#c0392b';
        const GREETING = 'שנה טובה';

        // --- Set canvas dimensions ---
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight + BOTTOM_PADDING;

        // --- Draw the elements onto the canvas ---
        // 1. Fill background with white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw the generated image
        ctx.drawImage(image, 0, 0);

        // 3. Configure and draw the text
        ctx.font = `${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textX = canvas.width / 2;
        const textY = image.naturalHeight + (BOTTOM_PADDING / 2);
        ctx.fillText(GREETING, textX, textY);

        // --- Trigger download ---
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png'); // Convert canvas to a PNG image data URL
        link.download = 'rosh-hashanah-card.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    image.onerror = () => {
        alert("שגיאה בטעינת התמונה להורדה.");
    };
    image.src = resultImage.src; // Start loading the image from the result view
});


/**
 * Resets the application to its initial state.
 */
resetButton.addEventListener('click', () => {
    uploadedImageBase64 = null;
    uploadedImageType = null;
    selectedStyle = null;

    fileUpload.value = '';
    imagePreview.src = '#';
    imagePreviewContainer.classList.add('hidden');
    styleSelection.classList.add('hidden');
    generateButton.classList.add('hidden');
    generateButton.disabled = true;
    uploadText.textContent = 'העלו תמונה';
    styleOptions.forEach(opt => opt.classList.remove('selected'));
    
    showView('upload');
});

// --- Initial Application State ---
showView('upload');
import { GoogleGenAI, Modality } from "@google/genai";

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
            const base64 = await fileToBase64(file);
            uploadedImageBase64 = base64; 

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
        childish: 'Redraw the entire image in a cute, colorful, and childish illustration style. Then, add a matching decorative frame around it suitable for a Rosh Hashanah (Jewish New Year) greeting card. The subject of the original image must remain clearly recognizable. Do not add any text or letters.',
        festive: 'Transform the entire image into a luxurious and festive renaissance-style painting. Then, add a matching elegant frame with gold elements, flowers, and pomegranates suitable for a Rosh Hashanah (Jewish New Year) greeting card. The subject of the original image must remain clearly recognizable. Do not add any text or letters.',
        natural: 'Add a festive frame suitable for a Rosh Hashanah (Jewish New Year) greeting card around the original image. The frame should include elegant elements like flowers and pomegranates. CRITICAL INSTRUCTION: Do not change, alter, or redraw the original image in any way. The original photo must be preserved exactly as it is, inside the new frame. Do not add any text or letters.',
        nostalgic: 'Transform the entire image into a nostalgic, early 20th-century "Shana Tova" greeting postcard illustration. The style should be a hand-drawn illustration, not a photograph, on a light-colored, old paper or parchment textured background. Use a soft yet rich color palette of reds, pinks, purples, and light greens, with a slightly faded effect as if from an old print. Then, add a matching decorative frame incorporating classic "Shana Tova" motifs like flowers, doves, pomegranates, and apples. The subject of the original image must remain clearly recognizable, and the overall atmosphere should be innocent and sweet. Do not add any text or letters.',
        floral: 'Change the clothes of all people in the image to simple white shirts and replace the background with a vibrant, sunlit field of flowers. Add a decorative frame made of colorful watercolor flowers around the entire image, including 2-3 small bees within the frame. CRITICAL INSTRUCTION: The faces of the people in the original image must be preserved perfectly and must not be altered, redrawn, or distorted in any way. The final result should be suitable for a Rosh Hashanah (Jewish New Year) greeting card. Do not add any text or letters.',
        sketch: 'Transform the uploaded photo into an artistic pencil sketch, presented on a clean white paper background. Surround the entire image with a DELICATE and elegant fine-line hand-drawn frame. This frame should be composed of Rosh Hashanah elements like apples, bees, and flowers. The elements within the frame (like the flowers and apples) should have subtle, gentle touches of watercolor, adding a hint of color. The frame itself should be delicate and not thick or overpowering. CRITICAL INSTRUCTION: The faces of the people in the original image must be preserved perfectly as part of the sketch, remaining clearly recognizable and not distorted. The final result should be suitable for a Rosh Hashanah (Jewish New Year) greeting card. Do not add any text or letters.'
    };
    
    const prompt = stylePrompts[selectedStyle] || stylePrompts['festive'];

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    { inlineData: { data: uploadedImageBase64, mimeType: uploadedImageType } },
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
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
    const image = new Image();
    image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            alert("לא ניתן היה ליצור את התמונה להורדה.");
            return;
        }

        const FONT_SIZE = Math.max(40, image.naturalWidth / 12);
        const BOTTOM_PADDING = FONT_SIZE * 1.5;
        const FONT_FAMILY = '"Noto Serif Hebrew", serif';
        const FONT_WEIGHT = '600';
        const TEXT_COLOR = '#c0392b';
        const GREETING = 'שנה טובה';

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight + BOTTOM_PADDING;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);

        ctx.font = `${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textX = canvas.width / 2;
        const textY = image.naturalHeight + (BOTTOM_PADDING / 2);
        ctx.fillText(GREETING, textX, textY);

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'rosh-hashanah-card.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    image.onerror = () => {
        alert("שגיאה בטעינת התמונה להורדה.");
    };
    image.src = resultImage.src;
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
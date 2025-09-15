/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from "@google/genai";

// --- DOM Element Selection ---
const app = document.getElementById('app');
const uploadView = document.getElementById('upload-view');
const loadingView = document.getElementById('loading-view');
const resultView = document.getElementById('result-view');

const fileInput = document.getElementById('file-upload') as HTMLInputElement;
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const uploadText = document.getElementById('upload-text');

const styleSelectionView = document.getElementById('style-selection');
const styleOptionButtons = document.querySelectorAll('.style-option');

const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const downloadButton = document.getElementById('download-button') as HTMLButtonElement;
const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
const resultImage = document.getElementById('result-image') as HTMLImageElement;

// --- State Management ---
let uploadedFile: { base64: string, mimeType: string } | null = null;
let generatedImageBase64: string | null = null;
let selectedStyle: string | null = null;

// --- Prompts for Different Styles ---
const stylePrompts: { [key: string]: string } = {
  childish: "The frame should have a childish style with colorful illustrations, smiling apples, bees, and other cute elements.",
  festive: "The frame should have a luxurious and festive design with a luxurious gold frame, flowers, and pomegranates.",
  natural: "The frame should have an organic, natural style with leaves, flowers, wheat, pomegranates, and apples.",
  nostalgic: "The frame should look like an old postcard, with pastel colors, paper textures, and a warm vintage feel."
};

// --- Main Application Logic ---
try {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  /**
   * Converts a file to a base64 encoded string.
   */
  async function fileToGenerativePart(file: File): Promise<{ base64: string, mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Updates the enabled/disabled state of the generate button.
   */
  function updateGenerateButtonState() {
      if (uploadedFile && selectedStyle) {
          generateButton.disabled = false;
      } else {
          generateButton.disabled = true;
      }
  }

  /**
   * Handles the file input change event.
   */
  async function handleFileChange() {
    const file = fileInput.files?.[0];
    if (file) {
      uploadedFile = await fileToGenerativePart(file);
      imagePreview.src = `data:${uploadedFile.mimeType};base64,${uploadedFile.base64}`;
      if (imagePreviewContainer && uploadText && styleSelectionView) {
        imagePreviewContainer.classList.remove('hidden');
        uploadText.textContent = "החליפו תמונה";
        styleSelectionView.classList.remove('hidden');
      }
      generateButton.classList.remove('hidden');
      updateGenerateButtonState();
    }
  }

  /**
   * Handles the selection of a frame style.
   */
  function handleStyleSelect(event: Event) {
    const target = event.currentTarget as HTMLButtonElement;
    selectedStyle = target.dataset.style || null;

    // Update button styles
    styleOptionButtons.forEach(btn => btn.classList.remove('selected'));
    target.classList.add('selected');

    updateGenerateButtonState();
  }

  /**
   * Calls the Gemini API to generate the framed image.
   */
  async function generateGreetingCard() {
    if (!uploadedFile) {
      alert("אנא העלו תמונה תחילה.");
      return;
    }
    if (!selectedStyle) {
        alert("אנא בחרו סגנון מסגרת.");
        return;
    }

    // Switch to loading view
    if (uploadView) uploadView.style.display = 'none';
    loadingView?.classList.remove('hidden');

    try {
      const basePrompt = "Place this image inside a festive frame for the Jewish New Year (Rosh Hashanah). The frame should not contain any text or words.";
      const stylePrompt = stylePrompts[selectedStyle] || stylePrompts['festive'];
      const fullPrompt = `${basePrompt} ${stylePrompt}`;
      
      const imagePart = {
        inlineData: {
          data: uploadedFile.base64,
          mimeType: uploadedFile.mimeType,
        },
      };
      const textPart = { text: fullPrompt };

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      // FIX: The result from generateContent is the response object.
      // Do not access a nested `response` property.
      const imageOutput = result.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
      
      if (imageOutput && imageOutput.inlineData) {
        generatedImageBase64 = `data:${imageOutput.inlineData.mimeType};base64,${imageOutput.inlineData.data}`;
        resultImage.src = generatedImageBase64;
        
        // Switch to result view
        loadingView?.classList.add('hidden');
        resultView?.classList.remove('hidden');
      } else {
        // The API might have returned only text (e.g., a safety refusal).
        const errorText = result.text;
        console.error("API did not return an image. Response text:", errorText);
        alert("המודל לא הצליח ליצור תמונה. נסו תמונה אחרת או סגנון אחר.");
        resetApp();
      }

    } catch (error) {
      console.error("Error generating image:", error);
      alert("אירעה שגיאה בעת יצירת כרטיס הברכה. אנא בדקו את המסוף ונסו שוב.");
      resetApp(); // Reset on error
    }
  }

  /**
   * Handles the download button click.
   */
  function handleDownload() {
    if (generatedImageBase64) {
      const link = document.createElement('a');
      link.href = generatedImageBase64;
      link.download = 'shana-tova-card.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Resets the application to its initial state.
   */
  function resetApp() {
    uploadedFile = null;
    generatedImageBase64 = null;
    selectedStyle = null;
    fileInput.value = '';

    if (imagePreviewContainer && uploadText && styleSelectionView) {
      imagePreviewContainer.classList.add('hidden');
      uploadText.textContent = "העלו תמונה";
      styleSelectionView.classList.add('hidden');
    }

    // Reset style buttons
    styleOptionButtons.forEach(btn => btn.classList.remove('selected'));

    generateButton.classList.add('hidden');
    generateButton.disabled = true;

    resultView?.classList.add('hidden');
    if (uploadView) uploadView.style.display = 'flex';
    loadingView?.classList.add('hidden');
  }

  // --- Event Listeners ---
  fileInput.addEventListener('change', handleFileChange);
  styleOptionButtons.forEach(button => {
    button.addEventListener('click', handleStyleSelect);
  });
  generateButton.addEventListener('click', generateGreetingCard);
  downloadButton.addEventListener('click', handleDownload);
  resetButton.addEventListener('click', resetApp);

} catch (error) {
  console.error("Failed to initialize the application:", error);
  if (app) {
    app.innerHTML = `<p style="color: red; text-align: center;">Error: Could not initialize the application. Please ensure your API key is set correctly and check the console for details.</p>`;
  }
}

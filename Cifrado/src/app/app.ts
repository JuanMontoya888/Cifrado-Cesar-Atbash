import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { GoogleGenAI } from '@google/genai';

// ============================================================
// DATA STRUCTURE: ResultItem
// This interface defines the core data model for processed 
// strings. It ensures that every piece of text is linked 
// to the specific shift value (key) that generated it.
// ============================================================
interface ResultItem {
  text: string;
  shift: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // ============================================================
  // APPLICATION STATE & CONFIGURATION
  // This section manages the reactive state of the UI and the
  // cryptographic parameters such as the alphabet and 
  // Spanish language frequency analysis data.
  // ============================================================
  protected readonly title = signal('Encryption & Shift Tracking Tool');

  initialText: string = "";

  resultText: Array<ResultItem> = [];
  resultadosProbables: Array<ResultItem> = [];
  topSugerencias: Array<ResultItem> = [];

  respuestaCoherenteIA: string = "";

  method: 'cesar' | 'atbash' = 'cesar';
  alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  displacement: number = 3;

  geminiApiKey: string = "";

  /** Statistical distribution of letters in Spanish for frequency analysis */
  private frecuenciasEspanol: { [key: string]: number } = {
    'A': 12.5, 'B': 1.4, 'C': 4.7, 'D': 5.9, 'E': 13.7, 'F': 0.7, 'G': 1.0,
    'H': 0.7, 'I': 6.2, 'J': 0.4, 'K': 0.0, 'L': 5.0, 'M': 3.1, 'N': 6.7,
    'Ñ': 0.3, 'O': 8.7, 'P': 2.5, 'Q': 0.9, 'R': 6.9, 'S': 8.0, 'T': 4.6,
    'U': 3.9, 'V': 0.9, 'W': 0.0, 'X': 0.2, 'Y': 0.9, 'Z': 0.5
  };

  // ============================================================
  // AI ANALYSIS SYSTEM: analizarResultadosConIA
  // This method integrates with the Google Gemini API to perform
  // heuristic analysis on brute-force results. 
  //
  // Responsibilities:
  // - Validate API credentials and existing data.
  // - Send potential decryptions to the LLM for natural language evaluation.
  // - Parse the AI's structured response to identify the "Winner" string.
  // - Re-map the selected text to its original shift value for UI display.
  // ============================================================
  public async analizarResultadosConIA() {
    if (this.resultText.length === 0) {
      Swal.fire('Attention', 'No results to analyze.', 'warning');
      return;
    }

    if (!this.geminiApiKey) {
      Swal.fire('Error', 'Gemini API Key is missing.', 'error');
      return;
    }

    Swal.fire({
      title: 'Analyzing with AI...',
      text: 'Identifying candidates and their shifts...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const ai = new GoogleGenAI({ apiKey: this.geminiApiKey });
      // Prepare a bulk list of strings for the AI context
      const listaParaAnalizar = this.resultText.map(item => item.text).join('\n');

      const prompt = `
        Analyze the following strings from a cryptographic brute-force attack.
        
        TASK:
        1. Identify the TOP 3 most viable candidate strings that resemble real Spanish.
        2. Select the ONE most coherent string (The Winner).
        3. Generate a logical and coherent RESPONSE to the text found in "The Winner".
        
        OUTPUT FORMAT (Strictly follow this):
        - Candidates: [string 1, string 2, string 3]
        - Winner: [The exact decrypted string]
        - Logical Response: [Your response to that string]
        
        LIST TO ANALYZE:
        ${listaParaAnalizar}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt
      });

      if (response.text) {
        const rawText = response.text;

        // Regex parsing to extract structured data from AI's text output
        const candidatesMatch = rawText.match(/Candidates: \[(.*?)\]/i);
        const winnerMatch = rawText.match(/Winner: \[(.*?)\]/i);
        const logicMatch = rawText.split(/Logical Response:/i);

        // Link AI suggestions back to their original metadata (Shift values)
        if (candidatesMatch) {
          const texts = candidatesMatch[1].split(',').map(s => s.trim());
          this.topSugerencias = texts.map(t => {
            const original = this.resultText.find(r => r.text === t);
            return { text: t, shift: original ? original.shift : 0 };
          });
        }

        // Isolate the winner and update the results view
        if (winnerMatch) {
          const winnerText = winnerMatch[1].trim();
          const winnerObject = this.resultText.find(r => r.text === winnerText);

          if (winnerObject) {
            this.resultadosProbables = [winnerObject];
            // Remove the winner from the general list to avoid redundancy
            this.resultText = this.resultText.filter(res => res.text !== winnerText);
          }
        }

        if (logicMatch.length > 1) {
          this.respuestaCoherenteIA = logicMatch[1].trim();
        }
      }

      Swal.close();
    } catch (error: any) {
      console.error(error);
      Swal.fire('Error', 'AI Service Error.', 'error');
    }
  }

  public copiarTexto(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Copied!',
        showConfirmButton: false,
        timer: 1000
      });
    });
  }

  // ============================================================
  // CRYPTOGRAPHIC ALGORITHMS: Caesar & Atbash
  // These methods handle the mathematical transformations of 
  // the input text based on the selected cipher.
  //
  // Responsibilities:
  // - Perform character rotation (Caesar) or mirroring (Atbash).
  // - Execute brute-force cycles when "deciphering" in Caesar mode.
  // - Handle wrapping and unknown characters (punctuation, spaces).
  // ============================================================
  private cifrarCesar(text: string, action: 'cifrar' | 'descifrar'): Array<ResultItem> {
    const n = this.alphabet.length;
    let localResults: Array<ResultItem> = [];

    if (action === 'cifrar') {
      const shiftVal = this.displacement;
      const resText = text.split('').map((char) => {
        const index = this.alphabet.indexOf(char);
        if (index === -1) return char; // Non-alphabetic chars are preserved
        const newIndex = (index + (shiftVal % n) + n) % n;
        return this.alphabet[newIndex];
      }).join('');
      localResults.push({ text: resText, shift: shiftVal });
    } else {
      // BRUTE FORCE: Iterate through all possible shifts in the alphabet
      for (let i: number = 0; i < n; i++) {
        const shiftVal = -i;
        const resText = text.split('').map((char) => {
          const index = this.alphabet.indexOf(char);
          if (index === -1) return char;
          const newIndex = (index + (shiftVal % n) + n) % n;
          return this.alphabet[newIndex];
        }).join('');
        localResults.push({ text: resText, shift: i });
      }
    }
    return localResults;
  }

  private cifrarAtbash(text: string): string {
    const n = this.alphabet.length;
    return text.split('').map((char) => {
      const index = this.alphabet.indexOf(char);
      if (index === -1) return char;
      // Flip the character index: first becomes last, second becomes second-to-last
      const newIndex = (n - 1) - index;
      return this.alphabet[newIndex];
    }).join('');
  }

  // ============================================================
  // MAIN CONTROLLER: procesarMensaje
  // Orchestrates the encryption/decryption workflow and 
  // manages the initial sorting of results based on language
  // frequency heuristics.
  //
  // Responsibilities:
  // - Reset the UI state for new operations.
  // - Delegate encryption to the specific algorithm.
  // - Sort brute-force results by probability (first letter frequency).
  // ============================================================
  public procesarMensaje(action: 'cifrar' | 'descifrar') {
    this.resultText = [];
    this.resultadosProbables = [];
    this.topSugerencias = [];
    this.respuestaCoherenteIA = "";

    if (!this.initialText) return;

    if (this.method === 'cesar') {
      let resultados = this.cifrarCesar(this.initialText, action);

      // Heuristic sorting: moves strings starting with common Spanish letters to the top
      if (action === 'descifrar') {
        resultados.sort((a, b) => {
          const frecA = this.frecuenciasEspanol[a.text.charAt(0).toUpperCase()] || 0;
          const frecB = this.frecuenciasEspanol[b.text.charAt(0).toUpperCase()] || 0;
          return frecB - frecA;
        });
      }
      this.resultText = resultados;
    } else {
      // Atbash is its own inverse; no brute force needed
      this.resultText.push({ text: this.cifrarAtbash(this.initialText), shift: 0 });
    }
  }
}
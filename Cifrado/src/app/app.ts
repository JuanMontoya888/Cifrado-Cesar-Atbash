import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Cifrado');
  // Configuraciones iniciales
  initialText: string = "";
  resultText: string = "";
  method: 'cesar' | 'atbash' = 'cesar';

  // data 01
  alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  displacement: number = 3;

  // function 01
  private fn01(text: string, action: 'cifrar' | 'descifrar'): string {
    const n = this.alphabet.length;

    // S01F01
    return text.split('').map((char) => {
      // S02F01
      const index = this.alphabet.indexOf(char);
      if (index === -1) return char;

      // S03F01
      const newIndex = action === 'cifrar' ? (index + this.displacement) % n : (index - this.displacement + n) % n;

      // S04F01
      return this.alphabet[newIndex];
    }).join('');
  }

  // function 02
  private fn02(text: string): string {
    // S01F02
    const n = this.alphabet.length;

    // S02F02
    return text.split('').map((char) => {
      // S03F02
      const index = this.alphabet.indexOf(char);
      if (index === -1) return char;

      // S04F02
      const newIndex = (n - 1) - index;

      // S05F02
      return this.alphabet[newIndex];
    }).join('');

  }

  // function 03
  public fn03(action: 'cifrar' | 'descifrar') {
    // S01F03
    if (this.method === 'cesar') this.resultText = this.fn01(this.initialText, action);
    else this.resultText = this.fn02(this.initialText);
  }

}

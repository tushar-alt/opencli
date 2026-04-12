import ora, { type Ora } from 'ora';

let activeSpinner: Ora | null = null;

export function startSpinner(text: string): void {
  if (activeSpinner) stopSpinner();
  activeSpinner = ora({ text, color: 'cyan' }).start();
}

export function updateSpinner(text: string): void {
  if (activeSpinner) activeSpinner.text = text;
}

export function stopSpinner(success?: string): void {
  if (!activeSpinner) return;
  if (success) {
    activeSpinner.succeed(success);
  } else {
    activeSpinner.stop();
  }
  activeSpinner = null;
}

export function failSpinner(text: string): void {
  if (activeSpinner) {
    activeSpinner.fail(text);
    activeSpinner = null;
  }
}

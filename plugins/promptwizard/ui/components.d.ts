export declare class UIComponents {
  constructor(config?: any);
  render(component: string, props?: any): string;
  createDashboard(data: any): string;
  createChart(type: string, data: any): string;
  createTable(headers: string[], rows: any[][]): string;
  createProgressBar(progress: number): string;
  createAlert(type: 'success' | 'warning' | 'error', message: string): string;
  initialize(): void;
  clearScreen(): void;
  moveCursor(x: number, y: number): void;
  renderHeader(title: string): string;
  renderMiniChart(data: any): string;
}
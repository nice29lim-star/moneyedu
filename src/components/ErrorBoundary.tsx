import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { PixelButton } from './PixelUI';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught component error:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-12 p-8 bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_#000] text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFEAA7] border-2 border-black flex items-center justify-center text-[#D63031] shadow-[3px_3px_0px_0px_#000]">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-black text-[#2D3436]">
            {this.props.fallbackTitle || '화면을 불러오는 중 일시적인 오류가 발생했습니다'}
          </h2>
          <p className="text-xs text-[#636E72] font-bold leading-relaxed">
            데이터 동기화 중 문제가 발생했거나 새로고침이 필요합니다. 아래 버튼을 눌러 다시 시도해주세요.
          </p>
          {this.state.error && (
            <div className="text-[11px] font-mono text-[#D63031] bg-[#FFF0F0] p-3 rounded-xl border border-black text-left overflow-auto max-h-24">
              {this.state.error.message}
            </div>
          )}
          <div className="pt-2">
            <PixelButton variant="gold" onClick={this.handleReset}>
              <span className="flex items-center gap-1.5 justify-center">
                <RefreshCw size={14} />
                <span>화면 새로고침</span>
              </span>
            </PixelButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

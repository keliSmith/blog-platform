 import { Component } from 'react';
 import { Result, Button } from 'antd';
 import type { ReactNode, ErrorInfo } from 'react';
 import { getT } from '../i18n';
 import { useThemeStore } from '../store/themeStore';
 
 interface ErrorBoundaryProps {
   children: ReactNode;
 }
 
 interface ErrorBoundaryState {
   hasError: boolean;
   error: Error | null;
 }
 
 class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
   constructor(props: ErrorBoundaryProps) {
     super(props);
     this.state = { hasError: false, error: null };
   }
 
   static getDerivedStateFromError(error: Error): ErrorBoundaryState {
     return { hasError: true, error };
   }
 
   componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
     console.error('ErrorBoundary caught an error:', error, errorInfo);
   }
 
   private handleRetry = () => {
     this.setState({ hasError: false, error: null });
   };
 
  render() {
    const t = getT(useThemeStore.getState().lang);
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={t('pageError')}
          subTitle={this.state.error?.message || t('unknownError')}
          extra={[
            <Button key="retry" type="primary" onClick={this.handleRetry}>
              {t('retry')}
            </Button>,
            <Button key="home" onClick={() => { window.location.href = '/'; }}>
              {t('backToHome')}
            </Button>,
          ]}
        />
      );
    }
 
     return this.props.children;
   }
 }
 
 export default ErrorBoundary;

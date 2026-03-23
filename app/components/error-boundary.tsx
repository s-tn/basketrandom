"use client"
import { Component, type ReactNode } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-red-500 mb-2 text-lg font-semibold">Something went wrong</p>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error?.message}</p>
            <Button onClick={() => this.setState({ hasError: false })}>Try Again</Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

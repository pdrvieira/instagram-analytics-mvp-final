import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/Overview";
import ConnectIG from "./pages/ConnectIG";
import Followers from "./pages/Followers";
import Content from "./pages/Content";
import Hours from "./pages/Hours";
import Hashtags from "./pages/Hashtags";
import Demographics from "./pages/Demographics";
import Export from "./pages/Export";
import Settings from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/auth"} component={Auth} />
      
      {/* Dashboard Routes */}
      <Route path={"/dashboard/overview"}>
        {() => (
          <DashboardLayout>
            <Overview />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/connect-ig"}>
        {() => (
          <DashboardLayout>
            <ConnectIG />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/followers"}>
        {() => (
          <DashboardLayout>
            <Followers />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/content"}>
        {() => (
          <DashboardLayout>
            <Content />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/hours"}>
        {() => (
          <DashboardLayout>
            <Hours />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/hashtags"}>
        {() => (
          <DashboardLayout>
            <Hashtags />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/demographics"}>
        {() => (
          <DashboardLayout>
            <Demographics />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/export"}>
        {() => (
          <DashboardLayout>
            <Export />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path={"/dashboard/settings"}>
        {() => (
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        )}
      </Route>

      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

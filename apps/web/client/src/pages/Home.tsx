import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Instagram, TrendingUp, Users, BarChart3 } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated, loading, logout } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Instagram className="w-16 h-16 mx-auto mb-4 text-pink-600 animate-pulse" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    setLocation("/dashboard/overview");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Instagram className="w-8 h-8 text-pink-600" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Instagram Analytics MVP
            </h1>
          </div>
          <Button onClick={() => setLocation("/auth")}>
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Análise Completa do Instagram
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Acompanhe seguidores, engajamento, hashtags e muito mais com dashboards profissionais
          </p>
          <Button size="lg" onClick={() => setLocation("/auth")} className="text-lg px-8 py-6">
            Começar Agora →
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card>
            <CardHeader>
              <Users className="w-10 h-10 text-purple-600 mb-2" />
              <CardTitle>Análise de Seguidores</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Quem segue, quem não segue de volta, novos seguidores e unfollows
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="w-10 h-10 text-pink-600 mb-2" />
              <CardTitle>Engajamento</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Likes, comentários, shares, saves - tudo em um só lugar
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="w-10 h-10 text-purple-600 mb-2" />
              <CardTitle>Horários Ideais</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Heatmap 7×24 mostrando quando seus seguidores estão mais ativos
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Instagram className="w-10 h-10 text-pink-600 mb-2" />
              <CardTitle>Hashtags</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Descubra quais hashtags geram mais engajamento
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
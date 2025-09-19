import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, WandSparkles, Clock, CheckCircle, AlertTriangle, RotateCcw, Expand, Lightbulb, User, LogOut, LogIn, History, Calendar, RefreshCw, Download, Sparkles, Info, UserX, Trash2, Settings, Upload, X, FileText, Image, File, RotateCcw as HistoryIcon, Filter } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GenerateResponse {
  success: boolean;
  id: string;
  html: string;
  toolDescription: string;
}

 interface CooldownResponse {
  remainingSeconds: number;
  canGenerate: boolean;
}

interface HistoryItem {
  id: string;
  prompt: string;
  toolType: string | null;
  category: string | null;
  toolName: string | null;
  generatedHtml: string;
  title: string | null;
  createdAt: string;
}

interface HistoryResponse {
  success: boolean;
  history: HistoryItem[];
  categories: string[];
  toolTypes: string[];
}

interface CustomToolType {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
}

interface CustomToolTypesResponse {
  success: boolean;
  customToolTypes: CustomToolType[];
}

interface CustomCategory {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
}

interface CustomCategoriesResponse {
  success: boolean;
  customCategories: CustomCategory[];
}

const TOOL_TYPES = [
  { value: "auto", label: "Any Tool (Let AI decide)" },
  { value: "quiz", label: "Interactive Quiz" },
  { value: "flashcards", label: "Flashcards" },
  { value: "chart", label: "Chart/Graph" },
  { value: "worksheet", label: "Worksheet" },
  { value: "timeline", label: "Timeline" },
  { value: "game", label: "Educational Game" },
  { value: "lecture", label: "Slideshow Lecture" },
  { value: "diagram", label: "Diagram/Infographic" },
];

const getToolTypesForUser = (isAuthenticated: boolean, customToolTypes: CustomToolType[] = []) => {
  const baseTypes = TOOL_TYPES;
  if (isAuthenticated) {
    const customTypes = customToolTypes.map(type => ({
      value: `custom-${type.id}`,
      label: type.name,
      isCustom: true,
      id: type.id,
      description: type.description
    }));

    return [
      ...baseTypes,
      ...customTypes,
      { value: "create-custom", label: "＋ Create New Custom Tool" }
    ];
  }
  return baseTypes;
};

const PREDEFINED_CATEGORIES: any[] = [];

const getCategoriesForUser = (isAuthenticated: boolean, customCategories: CustomCategory[] = []) => {
  const baseCategories = PREDEFINED_CATEGORIES;
  if (isAuthenticated) {
    const customCats = customCategories.map(category => ({
      value: `custom-${category.id}`,
      label: category.name,
      isCustom: true,
      id: category.id,
      description: category.description
    }));

    return [
      ...baseCategories,
      ...customCats,
      { value: "create-custom-category", label: "＋ Create New Custom Category" }
    ];
  }
  return baseCategories;
};

const EXAMPLE_PROMPTS = [
  {
    type: "quiz",
    title: "Interactive Quiz",
    prompt: "Create a 15-question multiple choice quiz about the solar system with explanations for each answer.",
    icon: "❓",
    color: "bg-blue-100 text-blue-600",
  },
  {
    type: "flashcards",
    title: "Digital Flashcards",
    prompt: "Make flashcards for learning basic French vocabulary - 20 common phrases with pronunciation guides.",
    icon: "📚",
    color: "bg-green-100 text-green-600",
  },
  {
    type: "chart",
    title: "Interactive Chart",
    prompt: "Create a bar chart showing population growth of major cities over the last century.",
    icon: "📊",
    color: "bg-purple-100 text-purple-600",
  },
  {
    type: "game",
    title: "Educational Game",
    prompt: "Build a word matching game to help kids learn animal names and sounds.",
    icon: "🎮",
    color: "bg-orange-100 text-orange-600",
  },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [toolType, setToolType] = useState("auto");
  const [category, setCategory] = useState("none");
  const [toolName, setToolName] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [customToolModalOpen, setCustomToolModalOpen] = useState(false);
  const [customToolType, setCustomToolType] = useState("");
  const [customToolDescription, setCustomToolDescription] = useState("");
  const [editingCustomTool, setEditingCustomTool] = useState<CustomToolType | null>(null);
  const [manageCustomToolsOpen, setManageCustomToolsOpen] = useState(false);
  const [customCategoryModalOpen, setCustomCategoryModalOpen] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customCategoryDescription, setCustomCategoryDescription] = useState("");
  const [editingCustomCategory, setEditingCustomCategory] = useState<CustomCategory | null>(null);

  // New state for history filtering and searching
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyToolTypeFilter, setHistoryToolTypeFilter] = useState("");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("");

  // Placeholder for isRateLimited and remainingCooldown if they are not defined elsewhere
  const isRateLimited = cooldownRemaining > 0;
  const remainingCooldown = cooldownRemaining;

  const { toast } = useToast();
  const { user, logout, isLoading: authLoading } = useAuth();
  const setLocation = useLocation()[1]; // Get setLocation function

  const { data: cooldownData } = useQuery<CooldownResponse>({
    queryKey: ["/api/cooldown"],
    refetchInterval: 1000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ["/api/history"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/history");
      return response.json() as Promise<HistoryResponse>;
    },
    enabled: !!user,
  });

  const { data: customToolTypesData } = useQuery<CustomToolTypesResponse>({
    queryKey: ["/api/custom-tool-types"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/custom-tool-types");
      return response.json() as Promise<CustomToolTypesResponse>;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes to prevent unnecessary refetches
  });

  const { data: customCategoriesData } = useQuery<CustomCategoriesResponse>({
    queryKey: ["/api/custom-categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/custom-categories");
      return response.json() as Promise<CustomCategoriesResponse>;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes to prevent unnecessary refetches
  });



  useEffect(() => {
    if (cooldownData) {
      setCooldownRemaining(cooldownData.remainingSeconds);
    }
  }, [cooldownData]);

  useEffect(() => {
    // Check for selected tool from history page
    const selectedTool = sessionStorage.getItem('selectedTool');
    if (selectedTool) {
      try {
        const tool = JSON.parse(selectedTool);
        setPrompt(tool.prompt);
        setToolType(tool.toolType || "auto");
        setGeneratedHtml(tool.generatedHtml);
        setToolDescription(tool.toolDescription);
        setShowResults(true);
        sessionStorage.removeItem('selectedTool');
      } catch (error) {
        console.error('Error parsing selected tool:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Ensure custom category form fields are populated when editing
    if (editingCustomCategory && customCategoryModalOpen) {
      console.log('useEffect setting form fields from editingCustomCategory:', editingCustomCategory);
      setCustomCategoryName(editingCustomCategory.name);
      setCustomCategoryDescription(editingCustomCategory.description || "");
    }
  }, [editingCustomCategory, customCategoryModalOpen]);

  // Removed redundant state for isGenerating

  const generateMutation = useMutation({
    mutationFn: async (data: { prompt: string; toolType?: string; category?: string; toolName?: string }) => {
      const response = await apiRequest("POST", "/api/generate", data);
      return response.json() as Promise<GenerateResponse>;
    },
    onSuccess: (data) => {
      setGeneratedHtml(data.html);
      setToolDescription(data.toolDescription);
      setShowResults(true);
      toast({
        title: "Tool Generated Successfully!",
        description: "Your educational tool is ready to use.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cooldown"] });
      // Automatically scroll to the tool iframe after a short delay
      setTimeout(() => {
        document.getElementById('toolIframe')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      // Removed setIsGenerating(false) as isGenerating is now computed
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: JSON.parse("{" + error.message.split('{')[1]).message || "Failed to generate educational tool. Please try again.",
      });
      // Removed setIsGenerating(false) as isGenerating is now computed
    },
  });

  const generateWithFilesMutation = useMutation({
    mutationFn: async (data: { prompt: string; toolType?: string; files: File[]; category?: string; toolName?: string }) => {
      const formData = new FormData();
      formData.append('prompt', data.prompt);
      if (data.toolType) {
        formData.append('toolType', data.toolType);
      }
      if (data.category) {
        formData.append('category', data.category);
      }
      if (data.toolName) {
        formData.append('toolName', data.toolName);
      }
      data.files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('/api/generate-with-files', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.parse("{" + error.message.split('{')[1]).message || 'Failed to generate with files');
      }

      return response.json() as Promise<GenerateResponse>;
    },
    onSuccess: (data) => {
      setGeneratedHtml(data.html);
      setToolDescription(data.toolDescription);
      setShowResults(true);
      setSelectedFiles([]);
      toast({
        title: "Tool Generated Successfully!",
        description: "Your educational tool with uploaded files is ready to use.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cooldown"] });
      // Automatically scroll to the tool iframe after a short delay
      setTimeout(() => {
        document.getElementById('toolIframe')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      // Removed setIsGenerating(false) as isGenerating is now computed
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: JSON.parse("{" + error.message.split('{')[1]).message || "Failed to generate educational tool with files. Please try again.",
      });
      // Removed setIsGenerating(false) as isGenerating is now computed
    },
  });

  const enhanceMutation = useMutation({
    mutationFn: async (data: { prompt: string }) => {
      const response = await apiRequest("POST", "/api/enhance-prompt", data);
      return response.json() as Promise<{ success: boolean; enhancedPrompt: string }>;
    },
    onSuccess: (data) => {
      setPrompt(data.enhancedPrompt);
      toast({
        title: "Prompt Enhanced!",
        description: "Your prompt has been improved with more details and learning objectives.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Enhancement Failed",
        description: JSON.parse("{" + error.message.split('{')[1]).message || "Failed to enhance prompt. Please try again.",
      });
    },
  });

  const createCustomToolTypeMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/custom-tool-types", data);
      return response.json() as Promise<{ success: boolean; customToolType: CustomToolType }>;
    },
    onSuccess: async (data) => {
      setCustomToolModalOpen(false);
      setCustomToolType("");
      setCustomToolDescription("");

      // Immediately update the cache with the new custom tool type
      queryClient.setQueryData<CustomToolTypesResponse>(["/api/custom-tool-types"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          customToolTypes: [...oldData.customToolTypes, data.customToolType]
        };
      });

      // Set the tool type immediately since we've updated the cache
      setToolType(`custom-${data.customToolType.id}`);

      toast({
        title: "Custom Tool Type Created!",
        description: `"${data.customToolType.name}" is now available and selected.`,
      });

      // Invalidate to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["/api/custom-tool-types"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Failed to create custom tool type. Please try again.",
      });
    },
  });

  const updateCustomToolTypeMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description?: string }) => {
      const response = await apiRequest("PUT", `/api/custom-tool-types/${data.id}`, {
        name: data.name,
        description: data.description,
      });
      return response.json() as Promise<{ success: boolean; customToolType: CustomToolType }>;
    },
    onSuccess: (data) => {
      // Immediately update the cache
      queryClient.setQueryData<CustomToolTypesResponse>(["/api/custom-tool-types"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          customToolTypes: oldData.customToolTypes.map(ct => 
            ct.id === data.customToolType.id ? data.customToolType : ct
          )
        };
      });

      setCustomToolModalOpen(false);
      setEditingCustomTool(null);
      setCustomToolType("");
      setCustomToolDescription("");

      toast({
        title: "Custom Tool Type Updated!",
        description: `"${data.customToolType.name}" has been updated successfully.`,
      });

      // Invalidate to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["/api/custom-tool-types"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update custom tool type. Please try again.",
      });
    },
  });

  const deleteCustomToolTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/custom-tool-types/${id}`);
      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: (data, deletedId) => {
      // Immediately update the cache by removing the deleted item
      queryClient.setQueryData<CustomToolTypesResponse>(["/api/custom-tool-types"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          customToolTypes: oldData.customToolTypes.filter(ct => ct.id !== deletedId)
        };
      });

      // Reset tool type if the deleted one was selected
      if (toolType === `custom-${deletedId}`) {
        setToolType('auto');
      }

      toast({
        title: "Custom Tool Type Deleted",
        description: "The custom tool type has been removed successfully.",
      });

      // Invalidate to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["/api/custom-tool-types"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || "Failed to delete custom tool type. Please try again.",
      });
    },
  });

  const createCustomCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await apiRequest("POST", "/api/custom-categories", data);
      return response.json() as Promise<{ success: boolean; customCategory: CustomCategory }>;
    },
    onSuccess: async (data) => {
      setCustomCategoryModalOpen(false);
      setCustomCategoryName("");
      setCustomCategoryDescription("");

      // Immediately update the cache with the new custom category
      queryClient.setQueryData<CustomCategoriesResponse>(["/api/custom-categories"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          customCategories: [...oldData.customCategories, data.customCategory]
        };
      });

      // Set the category immediately since we've updated the cache
      setCategory(`custom-${data.customCategory.id}`);

      toast({
        title: "Custom Category Created!",
        description: `"${data.customCategory.name}" is now available and selected.`,
      });

      // Invalidate to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["/api/custom-categories"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Failed to create custom category. Please try again.",
      });
    },
  });

  const updateCustomCategoryMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description?: string }) => {
      const response = await apiRequest("PUT", `/api/custom-categories/${data.id}`, {
        name: data.name,
        description: data.description,
      });
      return response.json() as Promise<{ success: boolean; customCategory: CustomCategory }>;
    },
    onSuccess: (data) => {
      // Immediately update the cache
      queryClient.setQueryData<CustomCategoriesResponse>(["/api/custom-categories"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          customCategories: oldData.customCategories.map(cat => 
            cat.id === data.customCategory.id ? data.customCategory : cat
          )
        };
      });

      setCustomCategoryModalOpen(false);
      setEditingCustomCategory(null);
      setCustomCategoryName("");
      setCustomCategoryDescription("");

      toast({
        title: "Custom Category Updated!",
        description: `"${data.customCategory.name}" has been updated successfully.`,
      });

      // Invalidate to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["/api/custom-categories"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update custom category. Please try again.",
      });
    },
  });

  const deleteCustomCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/custom-categories/${id}`);
      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: (data, deletedId) => {
      // Immediately update the cache by removing the deleted item
      queryClient.setQueryData<CustomCategoriesResponse>(["/api/custom-categories"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          customCategories: oldData.customCategories.filter(cat => cat.id !== deletedId)
        };
      });

      // Reset category if the deleted one was selected
      if (category === `custom-${deletedId}`) {
        setCategory('none');
      }

      toast({
        title: "Custom Category Deleted",
        description: "The custom category has been removed successfully.",
      });

      // Invalidate to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["/api/custom-categories"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || "Failed to delete custom category. Please try again.",
      });
    },
  });

  const deleteHistoryItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/history/${id}`);
      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: (data, deletedId) => {
      // Immediately update the cache by removing the deleted item
      queryClient.setQueryData<HistoryResponse>(["/api/history"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          history: oldData.history.filter(item => item.id !== deletedId)
        };
      });

      toast({
        title: "Tool Deleted",
        description: "The tool has been removed from your history.",
      });

      // Invalidate to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || "Failed to delete tool. Please try again.",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const maxFiles = 5;
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    // If no files selected (user canceled), don't change existing files
    if (files.length === 0) {
      return;
    }

    // Filter files by accepted types (same as drag and drop)
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.doc', '.docx', '.pptx', '.xlsx', '.csv'];
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 
      'image/jpg',
      'image/png', 
      'image/gif', 
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    const validFiles = files.filter(file => {
      const hasValidExtension = allowedExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext.toLowerCase())
      );
      const hasValidType = allowedTypes.includes(file.type);
      return hasValidExtension || hasValidType;
    });

    if (validFiles.length < files.length) {
      const invalidCount = files.length - validFiles.length;
      toast({
        variant: "destructive",
        title: "Invalid File Types",
        description: `${invalidCount} file(s) have unsupported formats and were ignored.`,
      });
    }

    if (validFiles.length === 0) {
      return;
    }

    // Check for duplicate files by name, size, and last modified (more robust)
    const existingFileIds = selectedFiles.map(f => `${f.name}-${f.size}-${f.lastModified}`);
    const newFiles = validFiles.filter(file => 
      !existingFileIds.includes(`${file.name}-${file.size}-${file.lastModified}`)
    );

    // Validate individual file sizes for new files
    const validSizedFiles = newFiles.filter(file => {
      if (file.size > maxFileSize) {
        toast({
          variant: "destructive",
          title: "File Too Large",
          description: `${file.name} is too large. Please keep files under 10MB.`,
        });
        return false;
      }
      return true;
    });

    // Calculate how many files we can actually add
    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = validSizedFiles.slice(0, remainingSlots);

    // Prepare summary messages
    const messages = [];
    if (validFiles.length > newFiles.length) {
      messages.push(`${validFiles.length - newFiles.length} duplicate(s) skipped`);
    }
    if (validSizedFiles.length > filesToAdd.length) {
      messages.push(`${validSizedFiles.length - filesToAdd.length} file(s) skipped (limit reached)`);
    }

    if (filesToAdd.length > 0) {
      // Append new files to existing ones
      setSelectedFiles(prev => [...prev, ...filesToAdd]);

      const successMsg = `${filesToAdd.length} file(s) added successfully`;
      const fullMsg = messages.length > 0 ? `${successMsg}. ${messages.join(', ')}.` : successMsg;

      toast({
        title: "Files Added",
        description: fullMsg,
      });
    } else if (messages.length > 0) {
      toast({
        title: "No Files Added",
        description: messages.join(', '),
      });
    }

    // Clear the input to allow selecting the same files again if needed
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const maxFiles = 5;
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    // If no files dropped, return
    if (files.length === 0) {
      return;
    }

    // Filter files by accepted types
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.doc', '.docx', '.pptx', '.xlsx', '.csv'];
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 
      'image/jpg',
      'image/png', 
      'image/gif', 
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];

    const validFiles = files.filter(file => {
      const hasValidExtension = allowedExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext.toLowerCase())
      );
      const hasValidType = allowedTypes.includes(file.type);
      return hasValidExtension || hasValidType;
    });

    if (validFiles.length < files.length) {
      const invalidCount = files.length - validFiles.length;
      toast({
        variant: "destructive",
        title: "Invalid File Types",
        description: `${invalidCount} file(s) have unsupported formats and were ignored.`,
      });
    }

    if (validFiles.length === 0) {
      return;
    }

    // Check for duplicate files by name, size, and last modified (more robust)
    const existingFileIds = selectedFiles.map(f => `${f.name}-${f.size}-${f.lastModified}`);
    const newFiles = validFiles.filter(file => 
      !existingFileIds.includes(`${file.name}-${file.size}-${file.lastModified}`)
    );

    // Validate individual file sizes for new files
    const validSizedFiles = newFiles.filter(file => {
      if (file.size > maxFileSize) {
        toast({
          variant: "destructive",
          title: "File Too Large",
          description: `${file.name} is too large. Please keep files under 10MB.`,
        });
        return false;
      }
      return true;
    });

    // Calculate how many files we can actually add
    const remainingSlots = maxFiles - selectedFiles.length;
    const filesToAdd = validSizedFiles.slice(0, remainingSlots);

    // Prepare summary messages
    const messages = [];
    if (validFiles.length > newFiles.length) {
      messages.push(`${validFiles.length - newFiles.length} duplicate(s) skipped`);
    }
    if (validSizedFiles.length > filesToAdd.length) {
      messages.push(`${validSizedFiles.length - filesToAdd.length} file(s) skipped (limit reached)`);
    }

    if (filesToAdd.length > 0) {
      // Append new files to existing ones
      setSelectedFiles(prev => [...prev, ...filesToAdd]);

      const successMsg = `${filesToAdd.length} file(s) added successfully`;
      const fullMsg = messages.length > 0 ? `${successMsg}. ${messages.join(', ')}.` : successMsg;

      toast({
        title: "Files Added",
        description: fullMsg,
      });
    } else if (messages.length > 0) {
      toast({
        title: "No Files Added",
        description: messages.join(', '),
      });
    }
  };



  const handleEnhancePrompt = () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Prompt Required",
        description: "Please enter a prompt to enhance.",
      });
      return;
    }

    enhanceMutation.mutate({
      prompt: prompt.trim(),
    });
  };

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    document.getElementById("promptInput")?.focus();
  };

  const handleRegenerate = () => {
    setShowResults(false);
    handleGenerate();
  };

  const handleFullscreen = () => {
    const iframe = document.getElementById("toolIframe") as HTMLIFrameElement;
    if (iframe && iframe.requestFullscreen) {
      iframe.requestFullscreen();
    }
  };



  const handleLogout = async () => {
    await logout();
    toast({
      title: "Goodbye!",
      description: "You have been logged out successfully.",
    });
    setLocation("/auth");
  };

  const handleClearProfile = async () => {
    if (confirm("Are you sure you want to clear your profile? This will remove all your saved tools but keep your account.")) {
      try {
        const response = await apiRequest("POST", "/api/clear-profile");
        const data = await response.json();

        if (data.success) {
          toast({
            title: "Profile Cleared",
            description: "Your profile has been cleared successfully.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/history"] });
          queryClient.invalidateQueries({ queryKey: ["/api/custom-tool-types"] });
          queryClient.invalidateQueries({ queryKey: ["/api/custom-categories"] });
          window.location.reload()
        } else {
          throw new Error(data.message || "Failed to clear profile");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to clear profile. Please try again.",
        });
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data.")) {
      try {
        const response = await apiRequest("DELETE", "/api/delete-account");
        const data = await response.json();

        if (data.success) {
          toast({
            title: "Account Deleted",
            description: "Your account has been deleted successfully.",
          });
          // Clear user state and redirect
          await logout();
          setLocation("/auth");
        } else {
          throw new Error(data.message || "Failed to delete account");
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to delete account. Please try again.",
        });
      }
    }
  };

  const handleHistoryItemClick = (item: HistoryItem) => {
    setPrompt(item.prompt);
    setToolType(item.toolType || "auto");
    setGeneratedHtml(item.generatedHtml);
    setToolDescription(item.title || `Generated ${item.toolType || 'tool'} from: "${item.prompt.slice(0, 100)}..."`);
    setShowResults(true);
    setSidebarOpen(false);
    setTimeout(() => setSidebarMounted(false), 300);
    // Automatically scroll to the tool iframe after a short delay
    setTimeout(() => {
      document.getElementById('toolIframe')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const formatHistoryItemLabel = (item: HistoryItem) => {
    const toolTypeLabel = item.toolType ? item.toolType.charAt(0).toUpperCase() + item.toolType.slice(1) : 'Tool';
    const categoryLabel = item.category ? item.category.charAt(0).toUpperCase() + item.category.slice(1) : '';
    const title = item.title || `Generated ${toolTypeLabel}`;
    return `${title} (${toolTypeLabel}${categoryLabel ? ` - ${categoryLabel}` : ''})`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " at " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDownload = (html: string, fileName?: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'expertlearning-tool.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCustomToolSubmit = () => {
    if (customToolType.trim()) {
      if (editingCustomTool) {
        updateCustomToolTypeMutation.mutate({
          id: editingCustomTool.id,
          name: customToolType.trim(),
          description: customToolDescription.trim() || undefined,
        });
      } else {
        createCustomToolTypeMutation.mutate({
          name: customToolType.trim(),
          description: customToolDescription.trim() || undefined,
        });
      }
    }
  };

  const handleCustomCategorySubmit = () => {
    if (customCategoryName.trim()) {
      console.log('handleCustomCategorySubmit called with:', {
        name: customCategoryName.trim(),
        description: customCategoryDescription.trim() || undefined,
        editingMode: !!editingCustomCategory
      });

      if (editingCustomCategory) {
        updateCustomCategoryMutation.mutate({
          id: editingCustomCategory.id,
          name: customCategoryName.trim(),
          description: customCategoryDescription.trim() || undefined,
        });
      } else {
        createCustomCategoryMutation.mutate({
          name: customCategoryName.trim(),
          description: customCategoryDescription.trim() || undefined,
        });
      }
    }
  };

  const handleGenerateWithFiles = () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a prompt for your educational tool.",
      });
      return;
    }
    if (!toolName.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a name for your educational tool.",
      });
      return;
    }
    if (isRateLimited) {
      toast({
        variant: "destructive",
        title: "Cooldown Active",
        description: `Please wait ${remainingCooldown} seconds before generating again.`,
      });
      return;
    }
    if (selectedFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "No Files Uploaded",
        description: "Please upload at least one file to generate with files.",
      });
      return;
    }

    // Removed setIsGenerating(true) as isGenerating is now computed
    try {
      // Convert custom tool type format to backend-compatible format
      let backendToolType = toolType;
      if (toolType.startsWith('custom-')) {
        const customId = toolType.replace('custom-', '');
        const customType = customToolTypesData?.customToolTypes.find(ct => ct.id === customId);
        backendToolType = customType ? customType.name.toLowerCase() : 'custom'; // Fallback to 'custom' if not found
      }

      // Convert custom category format to backend-compatible format
      let backendCategory = category;
      if (category && category !== "" && category !== "none" && category.startsWith('custom-')) {
        const customId = category.replace('custom-', '');
        const customCat = customCategoriesData?.customCategories.find(cat => cat.id === customId);
        backendCategory = customCat ? customCat.name.toLowerCase() : undefined;
      }

      const files = selectedFiles;
      generateWithFilesMutation.mutate({
        prompt: prompt.trim(),
        toolType: backendToolType,
        category: backendCategory,
        toolName: toolName.trim() || undefined,
        files: files,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error preparing files",
        description: error.message || "An unexpected error occurred while preparing your files.",
      });
      // Removed setIsGenerating(false) as isGenerating is now computed
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please enter a prompt to generate your tool.",
      });
      return;
    }

    if (!toolName.trim()) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a name for your educational tool.",
      });
      return;
    }

    if (isRateLimited) {
      toast({
        variant: "destructive",
        title: "Rate Limited",
        description: `Please wait ${remainingCooldown} seconds before generating another tool.`,
      });
      return;
    }

    // Removed setIsGenerating(true) as isGenerating is now computed
    try {
      // Convert custom tool type format to backend-compatible format
      let backendToolType = toolType;
      if (toolType.startsWith('custom-')) {
        const customId = toolType.replace('custom-', '');
        const customType = customToolTypesData?.customToolTypes.find(ct => ct.id === customId);
        backendToolType = customType ? customType.name.toLowerCase() : 'custom'; // Fallback to 'custom' if not found
      }

      // Convert custom category format to backend-compatible format
      let backendCategory = category;
      if (category && category !== "" && category !== "none" && category.startsWith('custom-')) {
        const customId = category.replace('custom-', '');
        const customCat = customCategoriesData?.customCategories.find(cat => cat.id === customId);
        backendCategory = customCat ? customCat.name.toLowerCase() : undefined;
      }

      // Check if we should use files generation or regular generation
      if (user && selectedFiles.length > 0) {
        generateWithFilesMutation.mutate({
          prompt: prompt.trim(),
          toolType: backendToolType,
          category: backendCategory,
          toolName: toolName.trim() || undefined,
          files: selectedFiles,
        });
      } else {
        generateMutation.mutate({
          prompt: prompt.trim(),
          toolType: backendToolType,
          category: backendCategory,
          toolName: toolName.trim() || undefined,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error during generation",
        description: JSON.parse("{" + error.message.split('{')[1]).message || "An unexpected error occurred.",
      });
      // Removed setIsGenerating(false) as isGenerating is now computed
    }
  };

  const isGenerating = generateMutation.isPending || generateWithFilesMutation.isPending;
  const canGenerate = cooldownData?.canGenerate && !isGenerating;

  // Filtered history items
  const filteredHistory = historyData?.history.filter(item => {
    const matchesSearch = item.prompt.toLowerCase().includes(historySearchTerm.toLowerCase()) || 
                        (item.toolName && item.toolName.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
                        (item.title && item.title.toLowerCase().includes(historySearchTerm.toLowerCase()));
    const matchesToolType = historyToolTypeFilter === "__all__" || historyToolTypeFilter === "" ? true : (item.toolType || '').toLowerCase() === historyToolTypeFilter.toLowerCase();
    const matchesCategory = historyCategoryFilter === "__all__" || historyCategoryFilter === "" ? true : (item.category || '').toLowerCase() === historyCategoryFilter.toLowerCase();
    return matchesSearch && matchesToolType && matchesCategory;
  }) || [];


  return (
    <div className="relative min-h-screen bg-background">
      {/* History Sidebar Overlay */}
      {user && sidebarMounted && (
        <>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 ${
              sidebarOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => {
              setSidebarOpen(false);
              setTimeout(() => setSidebarMounted(false), 300);
            }}
          />

          {/* Sidebar with Smooth Animation */}
          <div className={`fixed top-4 right-4 bottom-4 bg-card border border-border z-[100] flex flex-col shadow-2xl rounded-lg transition-all duration-300 ease-out ${
            sidebarOpen 
              ? 'translate-x-0 scale-100 opacity-100' 
              : 'translate-x-full scale-95 opacity-0'
          }`} style={{ width: window.innerWidth < 550 ? 90+"%" : 50+"%" }}>
            <div className="border-b border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
                    <History className="text-primary-foreground w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Tools History</h2>
                    <p className="text-sm text-muted-foreground">Your generated tools</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSidebarOpen(false);
                    setTimeout(() => setSidebarMounted(false), 300);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Filtering and Search Controls */}
            <div className="p-4 border-b border-border">
              <Input
                placeholder="Search history..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="mb-2"
              />
              <Select 
                value={historyToolTypeFilter}
                onValueChange={setHistoryToolTypeFilter}
              >
                <SelectTrigger className="mb-2">
                  <SelectValue placeholder="All Tool Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Tool Types</SelectItem>
                  {(historyData?.toolTypes || []).map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={historyCategoryFilter}
                onValueChange={setHistoryCategoryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {(historyData?.categories || []).map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading...</span>
                </div>
              ) : filteredHistory.length > 0 ? (
                (() => {
                  // Display filtered history items
                  return (
                    <div className="space-y-3">
                      {filteredHistory.slice(0, 20).map((item) => (
                        <div
                          key={item.id}
                          className="bg-accent/30 rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors border border-border/50"
                          onClick={() => handleHistoryItemClick(item)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center flex-shrink-0">
                                  <WandSparkles className="w-2 h-2 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                  {item.toolType ? item.toolType.charAt(0).toUpperCase() + item.toolType.slice(1) : 'Tool'}
                                </span>
                                {item.category && (
                                  <span className="text-xs px-1 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                                    {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-foreground font-medium mb-1 truncate">
                                {item.toolName || item.title || `Generated ${item.toolType ? item.toolType.charAt(0).toUpperCase() + item.toolType.slice(1) : 'tool'}`}
                              </p>
                              <p className="text-xs text-muted-foreground mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                "{item.prompt.slice(0, 50)}..."
                              </p>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(item.createdAt)}
                              </div>
                            </div>
                            <div className="ml-2 flex-shrink-0 flex flex-col space-y-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const fileName = `${item.toolType || 'tool'}_${item.createdAt.split('T')[0]}.html`;
                                  handleDownload(item.generatedHtml, fileName);
                                }}
                                className="h-6 w-6 p-0"
                                title="Download HTML"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this tool? This action cannot be undone.")) {
                                    deleteHistoryItemMutation.mutate(item.id);
                                  }
                                }}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                title="Delete Tool"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    {historySearchTerm || historyToolTypeFilter || historyCategoryFilter ? (
                      <Filter className="w-6 h-6 text-muted-foreground" />
                    ) : (
                      <History className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <h4 className="text-sm font-medium text-foreground mb-1">
                    {historySearchTerm || historyToolTypeFilter || historyCategoryFilter 
                      ? "No matching tools found" 
                      : "No tools yet"
                    }
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {historySearchTerm || historyToolTypeFilter || historyCategoryFilter 
                      ? "Try adjusting your search or filters." 
                      : "Create your first tool and it will appear here."
                    }
                  </p>
                </div>
              )
            }
            </div>
          </div>
        </>
      )}

      <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/"> {/* Logo now redirects to home */}
              <div className="flex items-center space-x-3 cursor-pointer">
                <img src="/logo.svg" alt="Expert Learning Logo" className="w-10 h-10" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">Expert Learning</h1>
                  <p className="text-sm text-muted-foreground">Using AI to Help You Study</p>
                </div>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              {!authLoading && (
                <>
                  {user ? (
                    <div className="flex items-center space-x-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="flex items-center space-x-2 bg-accent px-3 py-1 rounded-full cursor-pointer">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground" data-testid="text-username">
                              {user.username}
                            </span>
                            <Settings className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem className="flex items-center text-destructive focus:text-destructive" onClick={handleClearProfile}>
                            <UserX className="mr-2 h-4 w-4" />
                            <span>Clear Profile Data</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="flex items-center text-destructive focus:text-destructive" onClick={handleDeleteAccount}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Account</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        data-testid="button-logout"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <LogOut className="w-4 h-4 mr-1" />
                        Logout
                      </Button>
                    </div>
                  ) : (
                    <Link href="/auth">
                      <Button variant="ghost" size="sm" data-testid="button-login">
                        <LogIn className="w-4 h-4 mr-1" />
                        Sign In
                      </Button>
                    </Link>
                  )}

                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {user && (
        <Button
          variant="default"
          size="lg"
          onClick={() => {
            if (sidebarOpen) {
              setSidebarOpen(false);
              setTimeout(() => setSidebarMounted(false), 300);
            } else {
              setSidebarMounted(true);
              // Small delay to ensure mount completes before animation
              requestAnimationFrame(() => {
                setSidebarOpen(true);
              });
            }
          }}
          className="fixed top-24 right-6 z-30 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-200"
          title="View Tools History"
        >
          <History className="w-6 h-6" />
        </Button>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Create Educational Tools Instantly</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Describe what you need, and we'll effectively use AI to generate interactive quizzes, flashcards, charts, and more— ready to use in seconds.
          </p>
        </div>

        {!user && (
          <Card className="p-6 mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-1">
                  Unlock Extra Features
                </h3>
                <p className="text-blue-700 text-sm">
                  Sign in to access <strong>Custom Tool Types</strong>, <strong>Tools History</strong>, <strong>Tool Downloads</strong>, <strong>File Uploads</strong> and more, all for free!
                </p>
              </div>
              <Link href="/auth">
                <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                  Sign In
                </Button>
              </Link>
            </div>
          </Card>
        )}

        <Card className="p-8 mb-8">
          <div className="space-y-6">
            <div>
              <Label htmlFor="toolType" className="block text-sm font-medium text-foreground mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 01-1-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 2v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Tool Type
              </Label>
              <Select 
                key={`tool-select-${customToolTypesData?.customToolTypes?.length || 0}-${customToolTypesData?.customToolTypes?.map(ct => ct.id).join(',') || ''}`}
                value={toolType} 
                onValueChange={(value) => {
                  if (value === "create-custom") {
                    setEditingCustomTool(null);
                    setCustomToolType("");
                    setCustomToolDescription("");
                    setCustomToolModalOpen(true);
                  } else {
                    setToolType(value);
                  }
                }}
              >
                <SelectTrigger data-testid="select-tool-type">
                  <SelectValue placeholder="Select tool type *" />
                </SelectTrigger>
                <SelectContent>
                  {getToolTypesForUser(!!user, customToolTypesData?.customToolTypes).map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {(type as any).isCustom ? (
                        <div className="flex items-center justify-between w-full group">
                          <span className="flex-1">{type.label}</span>
                          <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const customTool = customToolTypesData?.customToolTypes.find(ct => ct.id === (type as any).id);
                                if (customTool) {
                                  setEditingCustomTool(customTool);
                                  setCustomToolType(customTool.name);
                                  setCustomToolDescription(customTool.description || "");
                                  setCustomToolModalOpen(true);
                                }
                              }}
                              className="h-6 w-6 p-1 hover:bg-blue-100 rounded"
                              title="Edit"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteCustomToolTypeMutation.mutate((type as any).id);
                              }}
                              className="h-6 w-6 p-1 hover:bg-red-100 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span>{type.label}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {user && (
              <div>
                <Label htmlFor="category" className="block text-sm font-medium text-foreground mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Category
                </Label>
                <Select 
                  key={`category-select-${customCategoriesData?.customCategories?.length || 0}-${customCategoriesData?.customCategories?.map(cat => cat.id).join(',') || ''}`}
                  value={category} 
                  onValueChange={(value) => {
                    if (value === "create-custom-category") {
                      setEditingCustomCategory(null);
                      setCustomCategoryName("");
                      setCustomCategoryDescription("");
                      setCustomCategoryModalOpen(true);
                    } else {
                      setCategory(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {getCategoriesForUser(!!user, customCategoriesData?.customCategories).map((categoryOption) => (
                      <SelectItem key={categoryOption.value} value={categoryOption.value}>
                        {(categoryOption as any).isCustom || (categoryOption as any).isEditable ? (
                          <div className="flex items-center justify-between w-full group">
                            <span className="flex-1">{categoryOption.label}</span>
                            {(categoryOption as any).isEditable && !categoryOption.value.startsWith('create-') && (
                              <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // For predefined categories, create a mock object for editing
                                    setEditingCustomCategory({
                                      id: categoryOption.value,
                                      name: categoryOption.label,
                                      description: '',
                                      userId: user?.id || '',
                                      createdAt: new Date().toISOString()
                                    });
                                    setCustomCategoryName(categoryOption.label);
                                    setCustomCategoryDescription('');
                                    setCustomCategoryModalOpen(true);
                                  }}
                                  className="h-6 w-6 p-1 hover:bg-blue-100 rounded"
                                  title="Edit"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toast({
                                      variant: "destructive",
                                      title: "Cannot Delete",
                                      description: "Default categories cannot be deleted. Only custom categories can be removed.",
                                    });
                                  }}
                                  className="h-6 w-6 p-1 hover:bg-red-100 rounded opacity-50 cursor-not-allowed"
                                  title="Cannot delete default category"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            )}
                            {(categoryOption as any).isCustom && (
                              <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const customCategory = customCategoriesData?.customCategories.find(cat => cat.id === (categoryOption as any).id);
                                    if (customCategory) {
                                      console.log('Edit button clicked for category:', customCategory);
                                      setEditingCustomCategory(customCategory);
                                      setCustomCategoryName(customCategory.name);
                                      setCustomCategoryDescription(customCategory.description || "");
                                      console.log('Set form fields:', {
                                        name: customCategory.name,
                                        description: customCategory.description || ""
                                      });
                                      // Small delay to ensure state is set before opening modal
                                      setTimeout(() => {
                                        setCustomCategoryModalOpen(true);
                                      }, 0);
                                    }
                                  }}
                                  className="h-6 w-6 p-1 hover:bg-blue-100 rounded"
                                  title="Edit"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    deleteCustomCategoryMutation.mutate((categoryOption as any).id);
                                  }}
                                  className="h-6 w-6 p-1 hover:bg-red-100 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>{categoryOption.label}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Organize your tools by subject or topic
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="toolNameInput" className="block text-sm font-medium text-foreground mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Tool Name
              </Label>
              <Input
                id="toolNameInput"
                data-testid="input-tool-name"
                value={toolName}
                onChange={(e) => setToolName(e.target.value.slice(0, 100))}
                placeholder="Give your tool a custom name..."
                className="mb-4"
              />
            </div>

            <div>
              <Label htmlFor="promptInput" className="block text-sm font-medium text-foreground mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Describe what you want to create
              </Label>
              <Textarea
                id="promptInput"
                data-testid="input-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Example: Create a quiz about World War II with 10 multiple choice questions, or make flashcards for Spanish vocabulary about food..."
                className="resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-muted-foreground flex items-center">
                  <Lightbulb className="w-3 h-3 mr-1" />
                  Be specific for best results
                </p>
                <span className={`text-sm ${prompt.length > 450 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {prompt.length}/500
                </span>
              </div>
            </div>

            {user && (
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2 flex items-center">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files (Optional)
                </Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    isDragOver 
                      ? 'border-primary bg-primary/10 border-solid' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx,.pptx,.xlsx,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center space-y-2"
                  >
                    <Upload className={`w-8 h-8 transition-colors duration-200 ${
                      isDragOver ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <p className={`text-sm transition-colors duration-200 ${
                      isDragOver ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}>
                      {isDragOver 
                        ? 'Drop files here to upload'
                        : 'Click to upload or drag and drop files here'
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDFs, images, text, Word, Excel, PowerPoint files • Max 5 files, 10MB each
                    </p>
                  </label>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">Selected Files:</p>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-accent/50 rounded-lg p-3">
                        <div className="flex items-center space-x-3">
                          {file.type.startsWith('image/') ? (
                            <Image className="w-5 h-5 text-green-600" />
                          ) : file.type === 'application/pdf' ? (
                            <FileText className="w-5 h-5 text-red-600" />
                          ) : (
                            <File className="w-5 h-5 text-blue-600" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 space-y-3">
              {user && (
                <Button
                  onClick={handleEnhancePrompt}
                  disabled={enhanceMutation.isPending || !prompt.trim()}
                  variant="outline"
                  className="w-full h-10 text-sm font-medium"
                  data-testid="button-enhance-prompt"
                >
                  {enhanceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enhancing Prompt...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Enhance Prompt with AI
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full h-12 text-base font-medium"
                data-testid="button-generate"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating Educational Tool...
                  </>
                ) : (
                  <>
                    <WandSparkles className="w-5 h-5 mr-2" />
                    Generate Educational Tool
                  </>
                )}
              </Button>

              {cooldownRemaining > 0 && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center space-x-2 bg-amber-50 text-amber-800 px-4 py-2 rounded-full text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Please wait {cooldownRemaining} seconds before generating again</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {isGenerating && (
          <Card className="p-8 mb-8 text-center">
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Creating your educational tool...</h3>
                <p className="text-muted-foreground">This may take a few moments while our AI processes your request.</p>
              </div>
              <div className="flex items-center justify-center space-x-8 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce mr-2"></div>
                  <span>Analyzing request</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce mr-2" style={{animationDelay: '0.15s'}}></div>
                  <span>Generating content</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce mr-2" style={{animationDelay: '0.3s'}}></div>
                  <span>Finalizing tool</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {showResults && generatedHtml && (
          <Card className="mb-8">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Tool Generated Successfully!</CardTitle>
                    <p className="text-sm text-muted-foreground" data-testid="text-tool-description">
                      {toolDescription}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={!canGenerate}
                    data-testid="button-regenerate"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleFullscreen}
                    data-testid="button-fullscreen"
                  >
                    <Expand className="w-4 h-4 mr-2" />
                    Fullscreen
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="bg-background rounded-lg border-2 border-border overflow-hidden" style={{height: '600px'}}>
                <iframe
                  id="toolIframe"
                  data-testid="iframe-tool"
                  srcDoc={generatedHtml}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  title="Generated Educational Tool"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {generateMutation.isError && (
          <Card className="border-destructive/20 mb-8">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h3>
                <p className="text-muted-foreground mb-4" data-testid="text-error-message">
                  {generateMutation.error?.message || "We couldn't generate your tool right now. Please check your prompt and try again."}
                </p>
                <Button onClick={handleGenerate} disabled={!canGenerate} data-testid="button-retry">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}



        <Card className="p-8">
          <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center">
            <Lightbulb className="w-6 h-6 mr-3 text-amber-500" />
            Example Prompts to Get Started
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <div
                key={index}
                className="bg-accent/50 rounded-lg p-4 cursor-pointer hover:bg-accent/70 transition-colors"
                onClick={() => handleExampleClick(example.prompt)}
                data-testid={`example-${example.type}`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`w-8 h-8 ${example.color} rounded-lg flex items-center justify-center flex-shrink-0 mt-1`}>
                    <span className="text-sm">{example.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">{example.title}</h4>
                    <p className="text-sm text-muted-foreground">"{example.prompt}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>

      {/* Custom Tool Type Modal */}
      <Dialog open={customToolModalOpen} onOpenChange={(open) => {
        setCustomToolModalOpen(open);
        if (!open) {
          setEditingCustomTool(null);
          setCustomToolType("");
          setCustomToolDescription("");
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCustomTool ? 'Edit Custom Tool Type' : 'Create Custom Tool Type'}</DialogTitle>
            <DialogDescription>
              {editingCustomTool ? 'Update your custom educational tool type.' : 'Define your custom educational tool type and its purpose.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="custom-tool-type" className="text-sm font-medium">
                Tool Type Name
              </Label>
              <Input
                id="custom-tool-type"
                placeholder="e.g., Interactive Simulation, Mind Map, etc."
                value={customToolType}
                onChange={(e) => setCustomToolType(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-tool-description" className="text-sm font-medium">
                Description (Optional)
              </Label>
              <Textarea
                id="custom-tool-description"
                placeholder="Describe what this tool type should do or how it should work..."
                value={customToolDescription}
                onChange={(e) => setCustomToolDescription(e.target.value)}
                className="w-full min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCustomToolModalOpen(false);
                setEditingCustomTool(null);
                setCustomToolType("");
                setCustomToolDescription("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCustomToolSubmit}
              disabled={!customToolType.trim() || createCustomToolTypeMutation.isPending || updateCustomToolTypeMutation.isPending}
            >
              {createCustomToolTypeMutation.isPending || updateCustomToolTypeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingCustomTool ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingCustomTool ? 'Update Tool Type' : 'Create Tool Type'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Category Modal */}
      <Dialog open={customCategoryModalOpen} onOpenChange={(open) => {
        setCustomCategoryModalOpen(open);
        if (!open && !editingCustomCategory) {
          setEditingCustomCategory(null);
          setCustomCategoryName("");
          setCustomCategoryDescription("");
        } else if (!open) {
          // Only clear editing state when modal closes, keep form data for a moment
          setTimeout(() => {
            setEditingCustomCategory(null);
            setCustomCategoryName("");
            setCustomCategoryDescription("");
          }, 100);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCustomCategory ? 'Edit Custom Category' : 'Create Custom Category'}</DialogTitle>
            <DialogDescription>
              {editingCustomCategory ? 'Update your custom category.' : 'Define your custom category for organizing your tools.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="custom-category-name" className="text-sm font-medium">
                Category Name
              </Label>
              <Input
                id="custom-category-name"
                placeholder="e.g., Advanced Physics, Creative Writing, etc."
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="custom-category-description" className="text-sm font-medium">
                Description (Optional)
              </Label>
              <Textarea
                id="custom-category-description"
                placeholder="Describe what type of content this category covers..."
                value={customCategoryDescription}
                onChange={(e) => setCustomCategoryDescription(e.target.value)}
                className="w-full min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCustomCategoryModalOpen(false);
                setEditingCustomCategory(null);
                setCustomCategoryName("");
                setCustomCategoryDescription("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCustomCategorySubmit}
              disabled={!customCategoryName.trim() || createCustomCategoryMutation.isPending || updateCustomCategoryMutation.isPending}
            >
              {createCustomCategoryMutation.isPending || updateCustomCategoryMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingCustomCategory ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingCustomCategory ? 'Update Category' : 'Create Category'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Built for teachers, students, and anyone who finds themselves in a quagmire.
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>© 2025 Expert Learning</span>
              <span>•</span>
              <a href='/tos' className="text-sm text-blue-600">Terms of Service</a>
              <span>•</span>
              <a href='/privacy' className="text-sm text-blue-600">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
        </div>
    </div>
  );
}
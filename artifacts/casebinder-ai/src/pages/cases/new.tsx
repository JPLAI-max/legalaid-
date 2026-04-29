import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { VoiceButton } from "@/components/ui/voice-button";
import { 
  useCreateCase, 
  CreateCaseBodyCaseType 
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const caseSchema = z.object({
  name: z.string().min(1, "Case name is required").max(100),
  caseType: z.nativeEnum(CreateCaseBodyCaseType, {
    required_error: "Please select a case type",
  }),
  parties: z.string().min(1, "Parties involved is required"),
  attorneyName: z.string().optional(),
  description: z.string().optional(),
});

type CaseFormValues = z.infer<typeof caseSchema>;

export function NewCase() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<CaseFormValues>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      name: "",
      caseType: undefined,
      parties: "",
      attorneyName: "",
      description: "",
    },
  });

  const createCase = useCreateCase({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Case created",
          description: "Your new case workspace is ready.",
        });
        setLocation(`/cases/${data.id}/overview`);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create case. Please try again.",
          variant: "destructive",
        });
      }
    }
  });

  function onSubmit(data: CaseFormValues) {
    createCase.mutate({ data });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLocation("/dashboard")}
          data-testid="btn-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create New Case</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case Details</CardTitle>
          <CardDescription>
            Enter the basic information about your legal matter to set up your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Case Name / Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Smith v. Jones, 2024 Custody Matter" {...field} data-testid="input-case-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="caseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Case Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-case-type">
                            <SelectValue placeholder="Select case type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="custody">Custody</SelectItem>
                          <SelectItem value="divorce">Divorce</SelectItem>
                          <SelectItem value="contract_dispute">Contract Dispute</SelectItem>
                          <SelectItem value="employment">Employment</SelectItem>
                          <SelectItem value="landlord_tenant">Landlord / Tenant</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attorneyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Attorney Name (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input placeholder="e.g. Jane Doe Esq." {...field} className="pr-9" data-testid="input-attorney-name" />
                          <VoiceButton
                            className="absolute right-1.5 top-1/2 -translate-y-1/2"
                            onTranscript={(text) => field.onChange(field.value ? field.value + " " + text : text)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="parties"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parties Involved</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input placeholder="List the main people involved" {...field} className="pr-9" data-testid="input-parties" />
                        <VoiceButton
                          className="absolute right-1.5 top-1/2 -translate-y-1/2"
                          onTranscript={(text) => field.onChange(field.value ? field.value + ", " + text : text)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Description (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Textarea 
                          placeholder="Brief summary of what this case is about..." 
                          className="resize-none pr-10" 
                          {...field} 
                          data-testid="textarea-description"
                        />
                        <VoiceButton
                          className="absolute top-2 right-2"
                          onTranscript={(text) => field.onChange(field.value ? field.value + " " + text : text)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation("/dashboard")}
                  data-testid="btn-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCase.isPending}
                  data-testid="btn-submit-case"
                >
                  {createCase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Workspace
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

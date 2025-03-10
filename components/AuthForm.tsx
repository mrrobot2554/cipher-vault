"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createAccount, signInUser, checkEmailBreach } from "@/lib/actions/user.actions";
import OtpModal from "@/components/OTPModal";

type FormType = "sign-in" | "sign-up";

const authFormSchema = (formType: FormType) => {
  return z.object({
    email: z.string().email(),
    fullName:
      formType === "sign-up"
        ? z.string().min(2).max(50)
        : z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });
};

const AuthForm = ({ type }: { type: FormType }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accountId, setAccountId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [breachResponse, setBreachResponse] = useState<any>(null);

  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const handleAction = async () => {
    if (!breachResponse) return;
    setIsLoading(true);

    const user = await createAccount({
      fullName: form.getValues("fullName") || "",
      email: form.getValues("email"),
      password: form.getValues("password"),
    });

    if(user.accountId == null && user.error && user.error != null) {
      setErrorMessage(user.error);
    }
    setAccountId(user.accountId);

    setIsLoading(false);
    setIsModalOpen(false);
  };

  const closeAllModals = () => {
    setIsModalOpen(false);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      if(type === "sign-up") {
        const breachResponse = await checkEmailBreach(values.email);
        console.log(breachResponse);
        if(breachResponse.error) {
          setErrorMessage(breachResponse.message);
          return;
        }

        if(!breachResponse.error && !breachResponse.safe) {
          setBreachResponse(breachResponse);
          setIsModalOpen(true);
          return;
        }
        setErrorMessage(breachResponse.message);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      const user =
        type === "sign-up"
          ? await createAccount({
              fullName: values.fullName || "",
              email: values.email,
              password: values.password
            })
          : await signInUser({ 
              email: values.email,
              password: values.password
          });
      
      if(user.accountId == null && user.error && user.error != null) {
        setErrorMessage(user.error);
      }
      setAccountId(user.accountId);
    } catch {
      setErrorMessage("Something went wrong! Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="auth-form">
          <h1 className="form-title">
            {type === "sign-in" ? "Sign In" : "Sign Up"}
          </h1>
          {type === "sign-up" && (
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <div className="shad-form-item">
                    <FormLabel className="shad-form-label">Full Name</FormLabel>

                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        className="shad-input"
                        {...field}
                      />
                    </FormControl>
                  </div>

                  <FormMessage className="shad-form-message" />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <div className="shad-form-item">
                  <FormLabel className="shad-form-label">Email</FormLabel>

                  <FormControl>
                    <Input
                      placeholder="Enter your email"
                      className="shad-input"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                </div>

                <FormMessage className="shad-form-message" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="shad-form-item">
                  <FormLabel className="shad-form-label">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      className="shad-input"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                </div>
                <FormMessage className="shad-form-message" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="form-submit-button"
            disabled={isLoading}
          >
            {type === "sign-in" ? "Sign In" : "Sign Up"}

            {isLoading && (
              <Image
                src="/assets/icons/loader.svg"
                alt="loader"
                width={24}
                height={24}
                className="ml-2 animate-spin"
              />
            )}
          </Button>

          {errorMessage && <p className="error-message" style={{ whiteSpace: 'pre-line' }}>*{errorMessage}</p>}

          <div className="body-2 flex justify-center">
            <p className="text-light-100">
              {type === "sign-in"
                ? "Don't have an account?"
                : "Already have an account?"}
            </p>
            <Link
              href={type === "sign-in" ? "/sign-up" : "/sign-in"}
              className="ml-1 font-medium text-brand"
            >
              {" "}
              {type === "sign-in" ? "Sign Up" : "Sign In"}
            </Link>
          </div>
        </form>
      </Form>

      {accountId && (
        <OtpModal email={form.getValues("email")} accountId={accountId} />
      )}
      
      {isModalOpen && breachResponse && (
        <Dialog open={isModalOpen}>
          <DialogContent className="shad-dialog button">
            <DialogHeader className="flex flex-col gap-3">
              <DialogTitle className="text-center text-light-100">
                ⚠️ Email Breach Warning
              </DialogTitle>
              <p style={{ whiteSpace: 'pre-line' }}>{breachResponse.message}</p>
              <p>Are you sure you want to proceed with account creation?</p>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-3 md:flex-row">
              <Button onClick={closeAllModals} className="modal-cancel-button">
                Cancel
              </Button>
              <Button onClick={handleAction} className="modal-submit-button">
                Proceed
                {isLoading && (
                  <Image
                    src="/assets/icons/loader.svg"
                    alt="loader"
                    width={24}
                    height={24}
                    className="animate-spin"
                  />
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default AuthForm;

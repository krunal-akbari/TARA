"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { ErrorBanner } from "@/components/common/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api/http";

interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

interface ContactService {
  list: () => Promise<Contact[]>;
  create: (_payload: { first_name: string; last_name: string; email: string | null; phone: string | null }) => Promise<Contact>;
  update: (_contactId: number, _payload: { first_name: string; last_name: string; email: string | null; phone: string | null }) => Promise<Contact>;
}

interface ContactManagerProps {
  queryKey: readonly unknown[];
  service: ContactService;
  title?: string;
}

const CONTACT_NAME_MAX = 128;
const CONTACT_EMAIL_MAX = 255;
const CONTACT_PHONE_MAX = 64;

export function ContactManager({ queryKey, service, title = "Contacts" }: ContactManagerProps) {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editingFirstName, setEditingFirstName] = useState("");
  const [editingLastName, setEditingLastName] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);

  const { data: contacts = [] } = useQuery({
    queryKey,
    queryFn: () => service.list(),
  });

  const createContactMutation = useMutation({
    mutationFn: (payload: { first_name: string; last_name: string; email: string | null; phone: string | null }) =>
      service.create(payload),
    onSuccess: () => {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setContactError(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setContactError(getApiErrorMessage(err, "Failed to add contact")),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, payload }: { contactId: number; payload: { first_name: string; last_name: string; email: string | null; phone: string | null } }) =>
      service.update(contactId, payload),
    onSuccess: () => {
      setEditingContactId(null);
      setEditingFirstName("");
      setEditingLastName("");
      setEditingEmail("");
      setEditingPhone("");
      setContactError(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setContactError(getApiErrorMessage(err, "Failed to update contact")),
  });

  const onCreateContact = (event: FormEvent) => {
    event.preventDefault();
    setContactError(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setContactError("First name and last name are required");
      return;
    }

    createContactMutation.mutate({
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      email: email.trim() ? email.trim() : null,
      phone: phone.trim() ? phone.trim() : null,
    });
  };

  const onStartEditContact = (contact: Contact) => {
    setEditingContactId(contact.id);
    setEditingFirstName(contact.first_name);
    setEditingLastName(contact.last_name);
    setEditingEmail(contact.email ?? "");
    setEditingPhone(contact.phone ?? "");
    setContactError(null);
  };

  const onCancelEditContact = () => {
    setEditingContactId(null);
    setEditingFirstName("");
    setEditingLastName("");
    setEditingEmail("");
    setEditingPhone("");
  };

  const onSaveEditedContact = (contactId: number) => {
    const trimmedFirstName = editingFirstName.trim();
    const trimmedLastName = editingLastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setContactError("First name and last name are required");
      return;
    }

    updateContactMutation.mutate({
      contactId,
      payload: {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        email: editingEmail.trim() ? editingEmail.trim() : null,
        phone: editingPhone.trim() ? editingPhone.trim() : null,
      },
    });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onCreateContact}>
        <div>
          <Label>First Name</Label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={CONTACT_NAME_MAX}
            placeholder="First name"
            required
          />
        </div>
        <div>
          <Label>Last Name</Label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={CONTACT_NAME_MAX}
            placeholder="Last name"
            required
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={CONTACT_EMAIL_MAX}
            placeholder="name@company.com"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={CONTACT_PHONE_MAX}
            placeholder="+1 555 000 0000"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={createContactMutation.isPending}>Add Contact</Button>
        </div>
      </form>
      <ErrorBanner message={contactError} />

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Phone</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr><td className="px-2 py-3 text-slate-600" colSpan={4}>No contacts found. Add one using the form above.</td></tr>
            ) : contacts.map((contact) => (
              editingContactId === contact.id ? (
                <tr key={contact.id} className="border-b bg-slate-50">
                  <td className="px-2 py-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={editingFirstName}
                        onChange={(e) => setEditingFirstName(e.target.value)}
                        maxLength={CONTACT_NAME_MAX}
                        placeholder="First name"
                      />
                      <Input
                        value={editingLastName}
                        onChange={(e) => setEditingLastName(e.target.value)}
                        maxLength={CONTACT_NAME_MAX}
                        placeholder="Last name"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="email"
                      value={editingEmail}
                      onChange={(e) => setEditingEmail(e.target.value)}
                      maxLength={CONTACT_EMAIL_MAX}
                      placeholder="name@company.com"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={editingPhone}
                      onChange={(e) => setEditingPhone(e.target.value)}
                      maxLength={CONTACT_PHONE_MAX}
                      placeholder="+1 555 000 0000"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => onSaveEditedContact(contact.id)}
                        disabled={updateContactMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button type="button" variant="ghost" onClick={onCancelEditContact}>Cancel</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={contact.id} className="border-b">
                  <td className="px-2 py-2">{contact.first_name} {contact.last_name}</td>
                  <td className="px-2 py-2">{contact.email ?? "-"}</td>
                  <td className="px-2 py-2">{contact.phone ?? "-"}</td>
                  <td className="px-2 py-2">
                    <Button type="button" variant="ghost" onClick={() => onStartEditContact(contact)}>Edit</Button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

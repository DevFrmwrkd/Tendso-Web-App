"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useAdminAuth } from "@/hooks/useAdmin"
import AdminLayout from "../components/AdminLayout"
import {
    Search,
    Plus,
    Phone,
    Mail,
    Globe,
    QrCode,
    ArrowUpRight,
    X,
    Pencil,
    Trash2,
    MoreVertical,
    Image as ImageIcon,
} from "lucide-react"
import LeadContentModal, { type LeadContentModalLead } from "./LeadContentModal"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    new: { label: "New", color: "bg-blue-100 text-blue-700" },
    contacted: { label: "Contacted", color: "bg-amber-100 text-amber-700" },
    qualified: { label: "Qualified", color: "bg-purple-100 text-purple-700" },
    converted: { label: "Converted", color: "bg-green-100 text-green-700" },
    lost: { label: "Lost", color: "bg-red-100 text-red-700" },
}

const SOURCE_ICON: Record<string, any> = {
    website: Globe,
    qr_code: QrCode,
    direct: ArrowUpRight,
}

export default function AdminLeadsPage() {
    const { isAdmin, loading: isLoading } = useAdminAuth()
    const leads = useQuery(api.leads.getAll)
    const createLead = useMutation(api.leads.create)
    const updateLead = useMutation(api.leads.update)
    const updateStatus = useMutation(api.leads.updateStatus)
    const deleteLead = useMutation(api.leads.remove)

    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    // For the "Add Lead" modal — fetch all submissions so admin can pick one from a dropdown
    const allSubmissions = useQuery(api.submissions.getAll)
    const [showAddModal, setShowAddModal] = useState(false)
    const [businessSearch, setBusinessSearch] = useState("")
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null)
    const [newLead, setNewLead] = useState({
        name: "",
        phone: "",
        email: "",
        message: "",
    })

    // Edit modal state
    const [editingLead, setEditingLead] = useState<any>(null)
    const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", message: "" })

    // Delete confirmation state
    const [deletingLead, setDeletingLead] = useState<any>(null)
    const [deleting, setDeleting] = useState(false)

    // Lead Content editor (mobile-CRM social card data)
    const [contentLead, setContentLead] = useState<LeadContentModalLead | null>(null)

    // Action dropdown state
    const [activeActionId, setActiveActionId] = useState<string | null>(null)

    // Close action dropdown when clicking outside
    useEffect(() => {
        if (!activeActionId) return
        const handler = () => setActiveActionId(null)
        document.addEventListener('click', handler)
        return () => document.removeEventListener('click', handler)
    }, [activeActionId])

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                </div>
            </AdminLayout>
        )
    }

    if (!isAdmin) {
        return (
            <AdminLayout>
                <div className="text-center py-20 text-gray-500">Admin access required</div>
            </AdminLayout>
        )
    }

    const filteredLeads = (leads || []).filter((lead) => {
        // name + phone became optional when Outscraper leads were added;
        // guard the .toLowerCase() / .includes() calls so a prospect lead
        // without a customer name doesn't crash the search filter.
        const matchesSearch =
            !search ||
            (lead.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (lead.phone ?? "").includes(search) ||
            (lead.email || "").toLowerCase().includes(search.toLowerCase()) ||
            (lead.businessName || "").toLowerCase().includes(search.toLowerCase())
        const matchesStatus = statusFilter === "all" || lead.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const statusCounts = (leads || []).reduce(
        (acc, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1
            return acc
        },
        {} as Record<string, number>
    )

    // Validation helpers
    const validateName = (name: string) => {
        if (!name.trim()) return 'Name is required'
        if (name.trim().length < 2) return 'Name must be at least 2 characters'
        return null
    }
    const validatePhone = (phone: string) => {
        if (!phone.trim()) return 'Phone number is required'
        const digits = phone.replace(/[^\d+]/g, '')
        if (digits.length < 7) return 'Phone number is too short'
        if (digits.length > 15) return 'Phone number is too long'
        return null
    }
    const validateEmail = (email: string) => {
        if (!email) return null // optional
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
        return null
    }

    const [addErrors, setAddErrors] = useState<Record<string, string>>({})
    const [editErrors, setEditErrors] = useState<Record<string, string>>({})

    const handleAddLead = async () => {
        const errors: Record<string, string> = {}
        const nameErr = validateName(newLead.name)
        const phoneErr = validatePhone(newLead.phone)
        const emailErr = validateEmail(newLead.email)
        if (nameErr) errors.name = nameErr
        if (phoneErr) errors.phone = phoneErr
        if (emailErr) errors.email = emailErr
        setAddErrors(errors)
        if (Object.keys(errors).length > 0) return
        try {
            await createLead({
                name: newLead.name,
                phone: newLead.phone,
                email: newLead.email || undefined,
                message: newLead.message || undefined,
                source: 'direct',
                // Only link to a submission if one was selected
                submissionId: selectedSubmission?._id as Id<"submissions"> | undefined,
                creatorId: selectedSubmission?.creatorId as Id<"creators"> | undefined,
            })
            setShowAddModal(false)
            setSelectedSubmission(null)
            setBusinessSearch("")
            setNewLead({ name: "", phone: "", email: "", message: "" })
            setAddErrors({})
        } catch (err: any) {
            alert(err.message || "Failed to add lead")
        }
    }

    const handleEditLead = async () => {
        if (!editingLead) return
        const errors: Record<string, string> = {}
        const nameErr = validateName(editForm.name)
        const phoneErr = validatePhone(editForm.phone)
        const emailErr = validateEmail(editForm.email)
        if (nameErr) errors.name = nameErr
        if (phoneErr) errors.phone = phoneErr
        if (emailErr) errors.email = emailErr
        setEditErrors(errors)
        if (Object.keys(errors).length > 0) return
        try {
            await updateLead({
                id: editingLead._id,
                name: editForm.name.trim(),
                phone: editForm.phone.trim(),
                email: editForm.email.trim() || undefined,
                message: editForm.message.trim() || undefined,
            })
            setEditingLead(null)
            setEditErrors({})
        } catch (err: any) {
            alert(err.message || "Failed to update lead")
        }
    }

    const handleDeleteLead = async () => {
        if (!deletingLead) return
        setDeleting(true)
        try {
            await deleteLead({ id: deletingLead._id })
            setDeletingLead(null)
        } catch (err: any) {
            alert(err.message || "Failed to delete lead")
        } finally {
            setDeleting(false)
        }
    }

    const openEdit = (lead: any) => {
        setEditForm({ name: lead.name ?? "", phone: lead.phone ?? "", email: lead.email || "", message: lead.message || "" })
        setEditingLead(lead)
        setActiveActionId(null)
    }

    const openDelete = (lead: any) => {
        setDeletingLead(lead)
        setActiveActionId(null)
    }

    // Filter submissions for the business picker dropdown
    const filteredSubmissions = (allSubmissions || []).filter((s: any) =>
        !businessSearch || s.businessName?.toLowerCase().includes(businessSearch.toLowerCase())
    ).slice(0, 8)

    return (
        <AdminLayout>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {leads?.length || 0} total leads across all submissions
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        <Plus size={18} />
                        Add Lead
                    </button>
                </div>

                {/* Status filter pills */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <button
                        onClick={() => setStatusFilter("all")}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                        All ({leads?.length || 0})
                    </button>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === key ? "bg-gray-900 text-white" : `${config.color} hover:opacity-80`}`}
                        >
                            {config.label} ({statusCounts[key] || 0})
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, phone, email, or business..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                </div>

                {/* Leads Table */}
                <div className="bg-white rounded-2xl border border-emerald-500 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Lead</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Business</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Source</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-gray-400">
                                            {search || statusFilter !== "all" ? "No leads match your filters" : "No leads yet"}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLeads.map((lead) => {
                                        const SourceIcon = SOURCE_ICON[lead.source] || ArrowUpRight
                                        const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
                                        return (
                                            <tr key={lead._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <p className="font-semibold text-gray-900 text-sm">{lead.name}</p>
                                                    {lead.message && (
                                                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{lead.message}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                                        <Phone size={13} className="text-gray-400" />
                                                        {lead.phone}
                                                    </div>
                                                    {lead.email && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                                                            <Mail size={11} className="text-gray-400" />
                                                            {lead.email}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm text-gray-700">{lead.businessName}</p>
                                                    <p className="text-xs text-gray-400">{lead.creatorName}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                        <SourceIcon size={14} />
                                                        {lead.source.replace("_", " ")}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <select
                                                        value={lead.status}
                                                        onChange={async (e) => {
                                                            try {
                                                                await updateStatus({
                                                                    id: lead._id,
                                                                    status: e.target.value as any,
                                                                })
                                                            } catch (err: any) {
                                                                alert(err.message)
                                                            }
                                                        }}
                                                        className={`text-xs font-bold px-2.5 py-1 rounded-full border-0 cursor-pointer ${statusCfg.color}`}
                                                    >
                                                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                                            <option key={key} value={key}>{config.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-gray-400">
                                                    {new Date(lead.createdAt).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="relative inline-block">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setActiveActionId(activeActionId === lead._id ? null : lead._id)
                                                            }}
                                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                        {activeActionId === lead._id && (
                                                            <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                                                <button
                                                                    onClick={() => openEdit(lead)}
                                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                                >
                                                                    <Pencil size={14} /> Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setContentLead({
                                                                            _id: lead._id,
                                                                            name: lead.name ?? lead.businessName ?? "(unnamed)",
                                                                            adminDescription: lead.adminDescription ?? null,
                                                                            externalPreviewUrl: lead.externalPreviewUrl ?? null,
                                                                            previewImageUrl: lead.previewImageUrl ?? null,
                                                                            previewImageStorageKey: lead.previewImageStorageKey ?? null,
                                                                        })
                                                                        setActiveActionId(null)
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                                >
                                                                    <ImageIcon size={14} /> Content
                                                                </button>
                                                                <button
                                                                    onClick={() => openDelete(lead)}
                                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Trash2 size={14} /> Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Lead Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
                            <div className="flex items-center justify-between p-5 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">Add New Lead</h3>
                                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                {/* Business picker — searchable dropdown that auto-fills submissionId + creatorId */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Link to Business <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                                    {selectedSubmission ? (
                                        <div className="mt-1 flex items-center justify-between px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{selectedSubmission.businessName}</p>
                                                <p className="text-xs text-gray-500">{selectedSubmission.city} · {selectedSubmission.businessType}</p>
                                            </div>
                                            <button onClick={() => { setSelectedSubmission(null); setBusinessSearch("") }} className="text-gray-400 hover:text-red-500">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative mt-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                value={businessSearch}
                                                onChange={(e) => setBusinessSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                placeholder="Search business name..."
                                            />
                                            {businessSearch && filteredSubmissions.length > 0 && (
                                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                    {filteredSubmissions.map((s: any) => (
                                                        <button
                                                            key={s._id}
                                                            onClick={() => {
                                                                setSelectedSubmission(s)
                                                                setBusinessSearch("")
                                                            }}
                                                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                                        >
                                                            <p className="text-sm font-medium text-gray-900">{s.businessName}</p>
                                                            <p className="text-xs text-gray-500">{s.city} · {s.ownerName}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {businessSearch && filteredSubmissions.length === 0 && (
                                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center">
                                                    <p className="text-xs text-gray-400">No businesses found</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name *</label>
                                        <input
                                            type="text"
                                            value={newLead.name}
                                            onChange={(e) => { setNewLead({ ...newLead, name: e.target.value }); setAddErrors((p) => ({ ...p, name: '' })) }}
                                            className={`w-full mt-1 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${addErrors.name ? 'border-red-400' : 'border-gray-200'}`}
                                            placeholder="Contact name"
                                        />
                                        {addErrors.name && <p className="text-xs text-red-500 mt-1">{addErrors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone *</label>
                                        <input
                                            type="text"
                                            value={newLead.phone}
                                            onChange={(e) => { setNewLead({ ...newLead, phone: e.target.value }); setAddErrors((p) => ({ ...p, phone: '' })) }}
                                            className={`w-full mt-1 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${addErrors.phone ? 'border-red-400' : 'border-gray-200'}`}
                                            placeholder="+63 9XX XXX XXXX"
                                        />
                                        {addErrors.phone && <p className="text-xs text-red-500 mt-1">{addErrors.phone}</p>}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                                    <input
                                        type="email"
                                        value={newLead.email}
                                        onChange={(e) => { setNewLead({ ...newLead, email: e.target.value }); setAddErrors((p) => ({ ...p, email: '' })) }}
                                        className={`w-full mt-1 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${addErrors.email ? 'border-red-400' : 'border-gray-200'}`}
                                        placeholder="Optional"
                                    />
                                    {addErrors.email && <p className="text-xs text-red-500 mt-1">{addErrors.email}</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Message</label>
                                    <textarea
                                        value={newLead.message}
                                        onChange={(e) => setNewLead({ ...newLead, message: e.target.value })}
                                        className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-20"
                                        placeholder="Optional notes"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
                                <button
                                    onClick={() => { setShowAddModal(false); setSelectedSubmission(null); setBusinessSearch("") }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddLead}
                                    disabled={!newLead.name || !newLead.phone}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    Add Lead
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Lead Modal */}
                {editingLead && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingLead(null)}>
                        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">Edit Lead</h3>
                                <button onClick={() => setEditingLead(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                {editingLead.businessName && editingLead.businessName !== 'Unlinked' && (
                                    <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500">
                                        Linked to: <span className="font-semibold text-gray-700">{editingLead.businessName}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name *</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); setEditErrors((p) => ({ ...p, name: '' })) }}
                                            className={`w-full mt-1 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${editErrors.name ? 'border-red-400' : 'border-gray-200'}`}
                                        />
                                        {editErrors.name && <p className="text-xs text-red-500 mt-1">{editErrors.name}</p>}
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone *</label>
                                        <input
                                            type="text"
                                            value={editForm.phone}
                                            onChange={(e) => { setEditForm({ ...editForm, phone: e.target.value }); setEditErrors((p) => ({ ...p, phone: '' })) }}
                                            className={`w-full mt-1 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${editErrors.phone ? 'border-red-400' : 'border-gray-200'}`}
                                        />
                                        {editErrors.phone && <p className="text-xs text-red-500 mt-1">{editErrors.phone}</p>}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => { setEditForm({ ...editForm, email: e.target.value }); setEditErrors((p) => ({ ...p, email: '' })) }}
                                        className={`w-full mt-1 px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${editErrors.email ? 'border-red-400' : 'border-gray-200'}`}
                                    />
                                    {editErrors.email && <p className="text-xs text-red-500 mt-1">{editErrors.email}</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Message</label>
                                    <textarea
                                        value={editForm.message}
                                        onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                                        className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-20"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
                                <button onClick={() => setEditingLead(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleEditLead}
                                    disabled={!editForm.name || !editForm.phone}
                                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deletingLead && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeletingLead(null)}>
                        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <div className="p-6 text-center">
                                <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                    <Trash2 className="text-red-600" size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Lead</h3>
                                <p className="text-sm text-gray-500 mb-1">
                                    Are you sure you want to delete this lead?
                                </p>
                                <p className="text-sm font-semibold text-gray-900 mb-1">{deletingLead.name}</p>
                                <p className="text-xs text-gray-400">{deletingLead.phone} · {deletingLead.businessName}</p>
                                <p className="text-xs text-red-500 mt-3">This action cannot be undone. All associated notes will also be deleted.</p>
                            </div>
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                                <button onClick={() => setDeletingLead(null)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteLead}
                                    disabled={deleting}
                                    className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                >
                                    {deleting ? 'Deleting...' : 'Delete Lead'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Lead Content editor (mobile-CRM social card) */}
                {contentLead && (
                    <LeadContentModal
                        lead={contentLead}
                        onClose={() => setContentLead(null)}
                    />
                )}
            </div>
        </AdminLayout>
    )
}

"""Enrichment Switcher - MPLC Demo"""

import hashlib
import json
import streamlit as st
import pandas as pd
from config_loader import (
    get_segments,
    get_segment,
    get_providers,
    is_provider_configured,
    get_segment_primary_provider,
    get_provider_display_name,
    get_full_config,
    save_config,
    reload_config,
)
from industry_mapping import get_industries, get_all_mappings
from providers.serper import search_local_businesses
from providers.apollo import enrich_company as apollo_enrich, search_contacts as apollo_contacts
from providers.zoominfo import enrich_company as zoominfo_enrich
from providers.clay import generate_claygent_brief
from providers.graphiq import search_by_capabilities

st.set_page_config(
    page_title="MPLC Prospect Intelligence",
    page_icon="▪",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# MPLC Brand CSS
st.markdown("""
<style>
    /* Import clean font */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    /* Global styles */
    .stApp {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background-color: #ffffff;
    }

    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}

    /* Custom header with logo */
    .mplc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 0;
        border-bottom: 1px solid #e5e5e5;
        margin-bottom: 2rem;
    }

    .mplc-logo {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        font-weight: 500;
        letter-spacing: 0.3em;
        color: #000;
        position: relative;
        padding: 8px 12px;
    }

    .mplc-logo::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 16px;
        height: 16px;
        border-top: 2px solid #000;
        border-left: 2px solid #000;
    }

    .mplc-logo::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 16px;
        height: 16px;
        border-bottom: 2px solid #000;
        border-left: 2px solid #000;
    }

    .mplc-title {
        font-size: 1rem;
        font-weight: 400;
        color: #666;
    }

    /* Main title styling */
    h1 {
        font-family: 'Inter', sans-serif !important;
        font-weight: 400 !important;
        font-size: 2.5rem !important;
        color: #000 !important;
        letter-spacing: -0.02em;
    }

    h2, h3 {
        font-family: 'Inter', sans-serif !important;
        font-weight: 500 !important;
        color: #000 !important;
    }

    /* Progress steps */
    .step-indicator {
        display: flex;
        gap: 2rem;
        margin: 2rem 0;
        padding: 1rem 0;
        border-bottom: 1px solid #e5e5e5;
    }

    .step {
        font-size: 0.875rem;
        color: #999;
        font-weight: 400;
    }

    .step.active {
        color: #000;
        font-weight: 500;
    }

    .step.completed {
        color: #000;
    }

    /* Buttons - MPLC style */
    .stButton > button {
        font-family: 'Inter', sans-serif !important;
        border-radius: 50px !important;
        padding: 0.6rem 1.5rem !important;
        font-weight: 500 !important;
        font-size: 0.875rem !important;
        transition: all 0.2s ease !important;
    }

    .stButton > button[kind="primary"] {
        background-color: #000 !important;
        color: #fff !important;
        border: none !important;
    }

    .stButton > button[kind="primary"]:hover {
        background-color: #333 !important;
    }

    .stButton > button[kind="secondary"] {
        background-color: #fff !important;
        color: #000 !important;
        border: 1px solid #000 !important;
    }

    /* Radio buttons */
    .stRadio > div {
        gap: 1rem;
    }

    .stRadio label {
        font-family: 'Inter', sans-serif !important;
    }

    /* Input fields */
    .stTextInput input, .stSelectbox select {
        font-family: 'Inter', sans-serif !important;
        border-radius: 8px !important;
        border: 1px solid #e5e5e5 !important;
    }

    .stTextInput input:focus, .stSelectbox select:focus {
        border-color: #000 !important;
        box-shadow: none !important;
    }

    /* Cards/containers */
    .result-card {
        background: #fafafa;
        border-radius: 12px;
        padding: 1.5rem;
        margin: 1rem 0;
        border: 1px solid #e5e5e5;
    }

    /* Metrics */
    [data-testid="stMetricValue"] {
        font-family: 'Inter', sans-serif !important;
        font-weight: 600 !important;
        color: #000 !important;
    }

    [data-testid="stMetricLabel"] {
        font-family: 'Inter', sans-serif !important;
        color: #666 !important;
    }

    /* Expander */
    .streamlit-expanderHeader {
        font-family: 'Inter', sans-serif !important;
        font-weight: 500 !important;
        background-color: #fafafa !important;
        border-radius: 8px !important;
    }

    /* Dataframe */
    .stDataFrame {
        font-family: 'Inter', sans-serif !important;
    }

    /* Dividers */
    hr {
        border-color: #e5e5e5 !important;
    }

    /* Provider status pills */
    .provider-status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.75rem;
        border-radius: 50px;
        font-size: 0.75rem;
        margin: 0.25rem;
    }

    .provider-configured {
        background: #e8f5e9;
        color: #2e7d32;
    }

    .provider-missing {
        background: #fafafa;
        color: #999;
    }

    /* Data source badge for results page */
    .data-source-container {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        padding: 0.75rem 0;
    }

    .data-source-label {
        font-family: 'Inter', sans-serif;
        font-size: 0.875rem;
        font-weight: 400;
        color: #666;
    }

    .data-source-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 1rem;
        border-radius: 50px;
        font-family: 'Inter', sans-serif;
        font-size: 0.8rem;
        font-weight: 500;
        background: #000;
        color: #fff;
        letter-spacing: 0.02em;
    }

    .data-source-badge::before {
        content: '';
        display: inline-block;
        width: 6px;
        height: 6px;
        background: #4ade80;
        border-radius: 50%;
    }

    /* Salesforce badge for demo */
    .sf-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #E8F4FC;
        color: #00A1E0;
        font-size: 0.7rem;
        font-weight: 500;
        padding: 3px 8px;
        border-radius: 12px;
        margin-left: 8px;
        vertical-align: middle;
    }

    .sf-badge svg {
        width: 12px;
        height: 12px;
        fill: #00A1E0;
    }

    /* Industry Mapping Table Styles */
    .industry-mapping-header {
        font-family: 'Inter', sans-serif;
        font-size: 1.25rem;
        font-weight: 500;
        color: #000;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e5e5e5;
    }

    .mapping-table-container {
        background: #fafafa;
        border-radius: 12px;
        padding: 1rem;
        border: 1px solid #e5e5e5;
    }

    .mapping-search-box {
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if "step" not in st.session_state:
    st.session_state.step = 1
if "segment" not in st.session_state:
    st.session_state.segment = None
if "results" not in st.session_state:
    st.session_state.results = []
if "selected_accounts" not in st.session_state:
    st.session_state.selected_accounts = []
if "claygent_briefs" not in st.session_state:
    st.session_state.claygent_briefs = []
if "admin_config" not in st.session_state:
    st.session_state.admin_config = None
if "admin_message" not in st.session_state:
    st.session_state.admin_message = None
if "delete_confirm" not in st.session_state:
    st.session_state.delete_confirm = None


def reset_wizard():
    """Reset wizard to step 1."""
    st.session_state.step = 1
    st.session_state.segment = None
    st.session_state.results = []
    st.session_state.selected_accounts = []
    st.session_state.claygent_briefs = []


def is_in_salesforce(company_name: str) -> bool:
    """Deterministically check if a company should show as 'in Salesforce' for demo.

    Uses a hash of the company name to ensure ~30% of companies consistently
    show the badge, and the same company always shows the same result.
    """
    if not company_name:
        return False
    # Create deterministic hash from company name
    name_hash = hashlib.md5(company_name.lower().encode()).hexdigest()
    # Convert first 8 hex chars to int and check if it falls in ~30% range
    hash_int = int(name_hash[:8], 16)
    return hash_int % 100 < 30


def get_sf_badge_html() -> str:
    """Return the HTML for the Salesforce badge."""
    # Simple cloud icon SVG
    return '''<span class="sf-badge">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
        </svg>
        In Salesforce
    </span>'''


def render_header():
    """Render MPLC branded header with home button."""
    col1, col2, col3 = st.columns([3, 1, 1])

    with col1:
        st.markdown("""
        <div style="padding: 1rem 0;">
            <span style="color:#666; font-size:1rem;">Prospect Intelligence</span>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        if st.session_state.step > 1:
            if st.button("Start Over", key="home_btn"):
                reset_wizard()
                st.rerun()

    with col3:
        st.markdown("""
        <div class="mplc-logo" style="text-align:right;">M P L C</div>
        """, unsafe_allow_html=True)

    st.markdown("<hr style='margin: 0 0 1.5rem 0; border-color: #e5e5e5;'>", unsafe_allow_html=True)


def render_progress():
    """Render progress steps."""
    steps = ["Select Segment", "Enter Criteria", "View Results", "AI Intelligence"]

    step_html = '<div class="step-indicator">'
    for i, step_name in enumerate(steps, 1):
        if i < st.session_state.step:
            step_html += f'<div class="step completed">&#10003; {step_name}</div>'
        elif i == st.session_state.step:
            step_html += f'<div class="step active">{i}. {step_name}</div>'
        else:
            step_html += f'<div class="step">{i}. {step_name}</div>'
    step_html += '</div>'

    st.markdown(step_html, unsafe_allow_html=True)


def render_admin():
    """Render the Admin configuration UI."""
    st.markdown('<div class="industry-mapping-header">Admin Configuration</div>', unsafe_allow_html=True)
    st.write("Manage segments and provider settings for the Enrichment Switcher.")

    # Load config into session state if not already loaded
    if st.session_state.admin_config is None:
        st.session_state.admin_config = get_full_config()

    config = st.session_state.admin_config

    # Show success/error messages
    if st.session_state.admin_message:
        msg_type, msg_text = st.session_state.admin_message
        if msg_type == "success":
            st.success(msg_text)
        elif msg_type == "error":
            st.error(msg_text)
        st.session_state.admin_message = None

    # Create tabs for different sections
    tab1, tab2, tab3 = st.tabs(["Segments", "Provider Status", "Save / Reset"])

    with tab1:
        render_admin_segments(config)

    with tab2:
        render_admin_providers(config)

    with tab3:
        render_admin_save_reset(config)


def render_admin_segments(config: dict):
    """Render the Segments management section."""
    st.subheader("Segment Configuration")
    st.write("Configure which segments are available and their display order.")

    segments = config.get("segments", [])
    providers = config.get("providers", {})
    provider_options = list(providers.keys())

    # Sort segments by order for display
    sorted_indices = sorted(range(len(segments)), key=lambda i: segments[i].get("order", 999))

    for display_idx, seg_idx in enumerate(sorted_indices):
        segment = segments[seg_idx]
        segment_id = segment.get("id", f"segment_{seg_idx}")

        # Segment card container
        with st.container():
            st.markdown(f"""
            <div style="background: #fafafa; border-radius: 12px; padding: 1rem; margin: 0.5rem 0; border: 1px solid #e5e5e5;">
            """, unsafe_allow_html=True)

            # Header row with segment ID and delete button
            col_header, col_delete = st.columns([5, 1])
            with col_header:
                st.markdown(f"**Segment: {segment_id}**")
            with col_delete:
                # Delete button with confirmation
                if st.session_state.delete_confirm == segment_id:
                    col_yes, col_no = st.columns(2)
                    with col_yes:
                        if st.button("Yes", key=f"confirm_delete_{segment_id}", type="primary"):
                            segments.pop(seg_idx)
                            st.session_state.delete_confirm = None
                            st.rerun()
                    with col_no:
                        if st.button("No", key=f"cancel_delete_{segment_id}"):
                            st.session_state.delete_confirm = None
                            st.rerun()
                else:
                    if st.button("Delete", key=f"delete_{segment_id}"):
                        st.session_state.delete_confirm = segment_id
                        st.rerun()

            # Editable fields
            col1, col2 = st.columns(2)

            with col1:
                new_display_name = st.text_input(
                    "Display Name",
                    value=segment.get("display_name", ""),
                    key=f"name_{segment_id}",
                )
                segment["display_name"] = new_display_name

                new_order = st.number_input(
                    "Display Order",
                    value=segment.get("order", display_idx + 1),
                    min_value=1,
                    max_value=100,
                    key=f"order_{segment_id}",
                )
                segment["order"] = new_order

            with col2:
                new_description = st.text_input(
                    "Description",
                    value=segment.get("description", ""),
                    key=f"desc_{segment_id}",
                )
                segment["description"] = new_description

                # Primary provider dropdown
                current_cascade = segment.get("providers", {}).get("cascade", [])
                current_primary = current_cascade[0] if current_cascade else provider_options[0] if provider_options else ""

                primary_idx = 0
                if current_primary in provider_options:
                    primary_idx = provider_options.index(current_primary)

                new_primary = st.selectbox(
                    "Primary Provider",
                    provider_options,
                    index=primary_idx,
                    key=f"provider_{segment_id}",
                )

                # Update the cascade with new primary
                if "providers" not in segment:
                    segment["providers"] = {"cascade": [], "fallback_enabled": False}
                if new_primary not in segment["providers"]["cascade"]:
                    segment["providers"]["cascade"] = [new_primary] + [p for p in segment["providers"]["cascade"] if p != new_primary]
                else:
                    # Move to front
                    cascade = segment["providers"]["cascade"]
                    cascade.remove(new_primary)
                    cascade.insert(0, new_primary)

            # Visible toggle
            new_visible = st.checkbox(
                "Visible",
                value=segment.get("visible", True),
                key=f"visible_{segment_id}",
            )
            segment["visible"] = new_visible

            st.markdown("</div>", unsafe_allow_html=True)

        st.markdown("---")

    # Add New Segment button
    st.write("")
    if st.button("Add New Segment", type="primary"):
        # Generate a unique ID
        existing_ids = [s.get("id", "") for s in segments]
        new_id = "new_segment"
        counter = 1
        while new_id in existing_ids:
            new_id = f"new_segment_{counter}"
            counter += 1

        # Calculate next order
        max_order = max([s.get("order", 0) for s in segments]) if segments else 0

        new_segment = {
            "id": new_id,
            "display_name": "New Segment",
            "description": "Description for new segment",
            "icon": "search",
            "visible": True,
            "order": max_order + 1,
            "providers": {
                "cascade": [provider_options[0]] if provider_options else [],
                "fallback_enabled": False
            },
            "input_fields": []
        }
        segments.append(new_segment)
        st.rerun()


def render_admin_providers(config: dict):
    """Render the Provider Status section."""
    st.subheader("Provider Status")
    st.write("View connection status and segment usage for each data provider.")

    providers = config.get("providers", {})
    segments = config.get("segments", [])

    for provider_id, provider_info in providers.items():
        # Check if configured
        configured = is_provider_configured(provider_id)
        status_color = "#2e7d32" if configured else "#d32f2f"
        status_text = "Connected" if configured else "Not Configured"
        status_icon = "check_circle" if configured else "cancel"

        # Find which segments use this provider
        using_segments = []
        for seg in segments:
            cascade = seg.get("providers", {}).get("cascade", [])
            fallback = seg.get("providers", {}).get("fallback", [])
            if provider_id in cascade or provider_id in fallback:
                usage = "primary" if cascade and cascade[0] == provider_id else "fallback"
                using_segments.append((seg.get("display_name", seg.get("id")), usage))

        # Provider card
        st.markdown(f"""
        <div style="background: #fafafa; border-radius: 12px; padding: 1rem; margin: 0.5rem 0; border: 1px solid #e5e5e5;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="font-size: 1.1rem;">{provider_info.get('name', provider_id)}</strong>
                    <span style="color: #666; font-size: 0.85rem; margin-left: 1rem;">Type: {provider_info.get('type', 'unknown')}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: {status_color}; display: inline-block;"></span>
                    <span style="color: {status_color}; font-weight: 500;">{status_text}</span>
                </div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # Show env var info
        env_info = ""
        if "env_keys" in provider_info:
            env_info = f"Required: {', '.join(provider_info['env_keys'])}"
        elif "env_key" in provider_info:
            env_info = f"Required: {provider_info['env_key']}"

        if env_info:
            st.caption(f"Environment variables: {env_info}")

        # Show segment usage
        if using_segments:
            usage_text = ", ".join([f"{name} ({role})" for name, role in using_segments])
            st.caption(f"Used by: {usage_text}")
        else:
            st.caption("Not used by any segment")

        st.write("")


def render_admin_save_reset(config: dict):
    """Render the Save/Reset section."""
    st.subheader("Save & Reset")
    st.write("Save your changes to the configuration file or reset to the last saved state.")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("""
        <div style="background: #fafafa; border-radius: 12px; padding: 1.5rem; border: 1px solid #e5e5e5;">
            <h4 style="margin-top: 0;">Save Changes</h4>
            <p style="color: #666; font-size: 0.9rem;">Write current configuration to <code>config/segments.json</code></p>
        </div>
        """, unsafe_allow_html=True)

        if st.button("Save Changes", type="primary", key="save_config"):
            try:
                success = save_config(config)
                if success:
                    st.session_state.admin_message = ("success", "Configuration saved successfully.")
                    reload_config()
                else:
                    st.session_state.admin_message = ("error", "Failed to save configuration.")
                st.rerun()
            except ValueError as e:
                st.session_state.admin_message = ("error", f"Validation error: {e}")
                st.rerun()
            except Exception as e:
                st.session_state.admin_message = ("error", f"Error saving configuration: {e}")
                st.rerun()

    with col2:
        st.markdown("""
        <div style="background: #fafafa; border-radius: 12px; padding: 1.5rem; border: 1px solid #e5e5e5;">
            <h4 style="margin-top: 0;">Reset to Default</h4>
            <p style="color: #666; font-size: 0.9rem;">Discard changes and reload from the saved file</p>
        </div>
        """, unsafe_allow_html=True)

        if st.button("Reset to Default", key="reset_config"):
            st.session_state.admin_config = None
            reload_config()
            st.session_state.admin_message = ("success", "Configuration reset to last saved state.")
            st.rerun()

    # Show current config preview
    st.write("")
    st.write("---")
    with st.expander("View Current Configuration (JSON)", expanded=False):
        st.code(json.dumps(config, indent=2), language="json")


def main():
    # Sidebar with Industry Mapping
    with st.sidebar:
        st.markdown("""
        <div class="mplc-logo" style="margin-bottom: 1.5rem;">M P L C</div>
        """, unsafe_allow_html=True)

        st.markdown("---")

        # Navigation
        # Admin flag - set to True for demo, can be controlled by env var or user role later
        show_admin = True

        nav_options = ["Prospect Search", "Industry Mapping"]
        if show_admin:
            nav_options.append("Admin")

        view = st.radio(
            "Navigation",
            nav_options,
            label_visibility="collapsed",
        )

        st.markdown("---")

        # Provider status in sidebar - driven by config
        st.write("**Data Sources**")
        providers_config = get_providers()
        for provider_id, provider_info in providers_config.items():
            configured = is_provider_configured(provider_id)
            icon = "●" if configured else "○"
            color = "#2e7d32" if configured else "#999"
            st.markdown(f"<span style='color:{color}'>{icon}</span> {provider_info['name']}", unsafe_allow_html=True)

    # Main content based on navigation
    if view == "Industry Mapping":
        render_header()
        render_industry_mapping()
    elif view == "Admin":
        render_header()
        render_admin()
    else:
        # Original prospect search flow
        render_header()

        # Main title based on step
        if st.session_state.step == 1:
            st.title("Find Your Next Prospects")
            st.write("Select a segment to begin building your prospect list with enriched data.")
        elif st.session_state.step == 2:
            st.title("Define Your Search")
        elif st.session_state.step == 3:
            st.title("Review Results")
        elif st.session_state.step == 4:
            st.title("AI Intelligence Briefs")

        render_progress()

        # Wizard steps
        if st.session_state.step == 1:
            render_step_1()
        elif st.session_state.step == 2:
            render_step_2()
        elif st.session_state.step == 3:
            render_step_3()
        elif st.session_state.step == 4:
            render_step_4()

        # Provider status in expander (kept for backward compatibility on main view)
        with st.expander("Data Sources", expanded=False):
            providers_list = list(get_providers().items())
            cols = st.columns(len(providers_list))
            for col, (provider_id, provider_info) in zip(cols, providers_list):
                configured = is_provider_configured(provider_id)
                status = "Connected" if configured else "Not configured"
                icon = "●" if configured else "○"
                col.write(f"{icon} **{provider_info['name']}**: {status}")


def render_industry_mapping():
    """Render the Industry Mapping reference view."""
    st.markdown('<div class="industry-mapping-header">Industry Mapping Reference</div>', unsafe_allow_html=True)
    st.write("Reference table showing how our industry names map to NAICS codes and Apollo search keywords.")

    # Get all mappings
    mappings = get_all_mappings()
    df = pd.DataFrame(mappings)

    # Rename columns for display
    df = df.rename(columns={
        "industry": "Industry Name",
        "naics_4": "NAICS 4-Digit",
        "naics_6": "NAICS 6-Digit Codes",
        "apollo_keywords": "Apollo Keywords",
        "notes": "Notes/Description",
    })

    # Search/filter functionality
    search_term = st.text_input(
        "Search industries",
        placeholder="Filter by industry name, NAICS code, or keyword...",
        key="industry_search",
    )

    if search_term:
        # Filter across all columns
        mask = df.apply(
            lambda row: row.astype(str).str.lower().str.contains(search_term.lower()).any(),
            axis=1
        )
        filtered_df = df[mask]
    else:
        filtered_df = df

    st.write(f"**{len(filtered_df)} industries**")

    # Display the table with styling
    st.dataframe(
        filtered_df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Industry Name": st.column_config.TextColumn("Industry Name", width="medium"),
            "NAICS 4-Digit": st.column_config.TextColumn("NAICS 4-Digit", width="small"),
            "NAICS 6-Digit Codes": st.column_config.TextColumn("NAICS 6-Digit Codes", width="medium"),
            "Apollo Keywords": st.column_config.TextColumn("Apollo Keywords", width="large"),
            "Notes/Description": st.column_config.TextColumn("Notes/Description", width="large"),
        },
    )

    # Download option
    csv = df.to_csv(index=False)
    st.download_button(
        "Download Full Mapping (CSV)",
        csv,
        "industry_mapping.csv",
        "text/csv",
    )


def render_step_1():
    """Step 1: Select Segment - driven by config"""

    st.write("")  # Spacing

    # Get visible segments from config
    segments = get_segments()

    # Create columns for segment cards
    cols = st.columns(len(segments))

    for col, segment in zip(cols, segments):
        with col:
            # Get primary provider for display
            primary_provider_id = get_segment_primary_provider(segment["id"])
            provider_name = get_provider_display_name(primary_provider_id) if primary_provider_id else "Unknown"

            st.markdown(f"""
            <div class="result-card">
                <h3 style="margin-top:0">{segment['display_name']}</h3>
                <p style="color:#666; font-size:0.9rem">{segment['description']}</p>
                <p style="color:#999; font-size:0.8rem">Data: {provider_name}</p>
            </div>
            """, unsafe_allow_html=True)

            if st.button(f"Select {segment['display_name']}", key=f"select_{segment['id']}", type="primary"):
                st.session_state.segment = segment["id"]
                st.session_state.step = 2
                st.rerun()


def render_dynamic_input_fields(segment_config: dict) -> dict:
    """Render input fields dynamically based on segment configuration.

    Args:
        segment_config: The segment configuration dictionary

    Returns:
        Dictionary of field_id -> value for all input fields
    """
    input_values = {}
    input_fields = segment_config.get("input_fields", [])

    # First pass: render radio/select fields that control visibility
    for field in input_fields:
        if field["type"] == "radio":
            options = field.get("options", [])
            default_idx = 0
            if field.get("default") in options:
                default_idx = options.index(field["default"])
            input_values[field["id"]] = st.radio(
                field["label"],
                options,
                index=default_idx,
                horizontal=field.get("horizontal", False),
            )

    # Second pass: render other fields, respecting show_when conditions
    for field in input_fields:
        if field["type"] == "radio":
            continue  # Already rendered

        # Check show_when conditions
        show_when = field.get("show_when", {})
        should_show = True
        for condition_field, condition_value in show_when.items():
            if input_values.get(condition_field) != condition_value:
                should_show = False
                break

        if not should_show:
            continue

        if field["type"] == "text":
            input_values[field["id"]] = st.text_input(
                field["label"],
                placeholder=field.get("placeholder", ""),
            )

        elif field["type"] == "select":
            # Check for special source types
            if field.get("source") == "industry_taxonomy":
                industries = get_industries()
                industry_names = [i["display_name"] for i in industries]
                selected_name = st.selectbox(field["label"], industry_names)
                # Store both the display name and the key
                selected_industry = next((i for i in industries if i["display_name"] == selected_name), None)
                input_values[field["id"]] = selected_industry["key"] if selected_industry else selected_name
                input_values[f"{field['id']}_display"] = selected_name
            else:
                options = field.get("options", [])
                input_values[field["id"]] = st.selectbox(field["label"], options)

        elif field["type"] == "slider":
            input_values[field["id"]] = st.slider(
                field["label"],
                min_value=field.get("min", 1),
                max_value=field.get("max", 100),
                value=field.get("default", 20),
            )

        elif field["type"] == "textarea":
            input_values[field["id"]] = st.text_area(
                field["label"],
                placeholder=field.get("placeholder", ""),
                height=field.get("height", 100),
            )

    return input_values


def render_step_2():
    """Step 2: Enter Criteria - uses segment-specific handlers for business logic"""
    segment_id = st.session_state.segment

    # Route to segment-specific handlers that contain the business logic
    if segment_id == "smb_local":
        render_smb_criteria()
    elif segment_id == "midmarket":
        render_midmarket_criteria()
    elif segment_id == "enterprise":
        render_enterprise_criteria()
    elif segment_id == "capability":
        render_capability_criteria()
    else:
        # Fallback for unknown segments
        st.error(f"Unknown segment: {segment_id}")


def render_smb_criteria():
    """SMB criteria form - driven by config with business logic."""
    segment_config = get_segment("smb_local")
    st.subheader("Local Business Search")

    # Render dynamic input fields from config
    col1, col2 = st.columns(2)

    with col1:
        # Industry field - using industry taxonomy
        industries = get_industries()
        industry_names = [i["display_name"] for i in industries]
        selected_name = st.selectbox("Industry", industry_names)
        selected_industry = next((i for i in industries if i["display_name"] == selected_name), None)
        industry_key = selected_industry["key"] if selected_industry else selected_name

    with col2:
        location = st.text_input("Location", placeholder="e.g., Austin, TX or 90210")

    num_results = st.slider("Number of results", 5, 50, 20)

    st.write("")  # Spacing

    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("Back"):
            st.session_state.step = 1
            st.rerun()
    with col2:
        if st.button("Search", type="primary"):
            if not location:
                st.error("Please enter a location")
                return

            if not is_provider_configured("serper"):
                st.error("Serper API key not configured")
                return

            with st.spinner(f"Searching for {selected_name} in {location}..."):
                try:
                    results = search_local_businesses(industry_key, location, num_results)
                    st.session_state.results = results
                    st.session_state.step = 3
                    st.rerun()
                except Exception as e:
                    st.error(f"Search failed: {e}")


def render_midmarket_criteria():
    """Mid-Market criteria form - driven by config with business logic."""
    segment_config = get_segment("midmarket")
    st.subheader("Company Enrichment")

    input_type = st.radio("Search by", ["Domain", "Company Name"], horizontal=True)

    if input_type == "Domain":
        domain = st.text_input("Company Domain", placeholder="e.g., notion.com")
        name = None
    else:
        name = st.text_input("Company Name", placeholder="e.g., Notion")
        domain = None

    st.write("")

    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("Back"):
            st.session_state.step = 1
            st.rerun()
    with col2:
        if st.button("Enrich", type="primary"):
            if not domain and not name:
                st.error("Please enter a domain or company name")
                return

            if not is_provider_configured("apollo"):
                st.error("Apollo API key not configured")
                return

            with st.spinner("Enriching company data..."):
                try:
                    company = apollo_enrich(domain=domain, name=name)
                    if not company:
                        st.warning("Company not found")
                        return

                    contacts = []
                    if company.get("domain"):
                        contacts = apollo_contacts(company["domain"], limit=5)

                    st.session_state.results = [{
                        "company": company,
                        "contacts": contacts,
                    }]
                    st.session_state.step = 3
                    st.rerun()
                except Exception as e:
                    st.error(f"Enrichment failed: {e}")


def render_enterprise_criteria():
    """Enterprise criteria form - driven by config with business logic."""
    segment_config = get_segment("enterprise")
    st.subheader("Enterprise Enrichment")

    domain = st.text_input("Company Domain", placeholder="e.g., salesforce.com")

    st.write("")

    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("Back"):
            st.session_state.step = 1
            st.rerun()
    with col2:
        if st.button("Enrich", type="primary"):
            if not domain:
                st.error("Please enter a domain")
                return

            if not is_provider_configured("zoominfo"):
                st.error("ZoomInfo credentials not configured")
                return

            with st.spinner("Enriching with ZoomInfo..."):
                try:
                    result = zoominfo_enrich(domain)
                    if not result:
                        st.warning("Company not found")
                        return

                    st.session_state.results = [result]
                    st.session_state.step = 3
                    st.rerun()
                except Exception as e:
                    st.error(f"Enrichment failed: {e}")


def render_capability_criteria():
    """Capability search criteria form - driven by config with business logic."""
    segment_config = get_segment("capability")
    st.subheader("Capability-Based Search")
    st.write("Find companies by their technical capabilities, products, or expertise.")

    capabilities_input = st.text_area(
        "Capabilities",
        placeholder="Enter capabilities separated by commas\ne.g., CNC machining, precision manufacturing, aerospace components",
        height=100,
    )

    num_results = st.slider("Number of results", 5, 50, 20)

    st.write("")

    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("Back"):
            st.session_state.step = 1
            st.rerun()
    with col2:
        if st.button("Search", type="primary"):
            if not capabilities_input.strip():
                st.error("Please enter at least one capability")
                return

            if not is_provider_configured("graphiq"):
                st.error("GraphiqAI API key not configured")
                return

            # Parse capabilities from comma-separated input
            capabilities = [c.strip() for c in capabilities_input.split(",") if c.strip()]

            with st.spinner(f"Searching for companies with capabilities: {', '.join(capabilities)}..."):
                try:
                    results = search_by_capabilities(capabilities, limit=num_results)
                    if not results:
                        st.warning("No companies found with those capabilities")
                        return
                    st.session_state.results = results
                    st.session_state.step = 3
                    st.rerun()
                except Exception as e:
                    st.error(f"Search failed: {e}")


def get_provider_for_segment(segment_id: str) -> str:
    """Return the data provider display name for a given segment - driven by config."""
    primary_provider_id = get_segment_primary_provider(segment_id)
    if primary_provider_id:
        return get_provider_display_name(primary_provider_id)
    return "Unknown"


def render_step_3():
    """Step 3: View Results"""
    segment = st.session_state.segment
    results = st.session_state.results

    # Display data source badge
    provider = get_provider_for_segment(segment)
    st.markdown(f"""
    <div class="data-source-container">
        <span class="data-source-label">Data source:</span>
        <span class="data-source-badge">{provider}</span>
    </div>
    """, unsafe_allow_html=True)

    if not results:
        st.warning("No results found")
        if st.button("Back"):
            st.session_state.step = 2
            st.rerun()
        return

    if segment == "smb":
        render_smb_results(results)
    elif segment == "capability":
        render_capability_results(results)
    else:
        render_company_results(results, segment)

    st.write("")
    st.divider()

    col1, col2, col3 = st.columns([1, 2, 3])
    with col1:
        if st.button("Back"):
            st.session_state.step = 2
            st.rerun()
    with col2:
        if st.button("Generate AI Briefs", type="primary"):
            if not st.session_state.selected_accounts:
                st.error("Select at least one account")
            else:
                st.session_state.step = 4
                st.rerun()


def render_smb_results(results):
    """Render SMB local business results."""
    st.write(f"**{len(results)} businesses found**")

    df = pd.DataFrame(results)

    selected = []
    for i, row in df.iterrows():
        col1, col2 = st.columns([0.05, 0.95])
        with col1:
            if st.checkbox("", key=f"select_{i}"):
                selected.append({
                    "name": row["name"],
                    "domain": row.get("website", ""),
                })
        with col2:
            # Check if this company should show Salesforce badge
            sf_badge = get_sf_badge_html() if is_in_salesforce(row['name']) else ""
            st.markdown(f"""
            <div class="result-card">
                <strong>{row['name']}</strong>{sf_badge}<br>
                <span style="color:#666">{row['address']}</span><br>
                <span style="color:#999; font-size:0.85rem">
                    {row.get('phone', '')} {'|' if row.get('phone') and row.get('website') else ''} {row.get('website', '')}
                    {f"| Rating: {row.get('rating')}" if row.get('rating') else ''}
                </span>
            </div>
            """, unsafe_allow_html=True)

    st.session_state.selected_accounts = selected

    csv = df.to_csv(index=False)
    st.download_button(
        "Download CSV",
        csv,
        "prospects.csv",
        "text/csv",
    )


def render_capability_results(results):
    """Render GraphiqAI capability search results."""
    st.write(f"**{len(results)} companies found**")

    selected = []
    for i, company in enumerate(results):
        col1, col2 = st.columns([0.05, 0.95])
        with col1:
            if st.checkbox("", key=f"select_cap_{i}"):
                selected.append({
                    "name": company.get("name", ""),
                    "domain": company.get("domain", ""),
                })
        with col2:
            caps = company.get("capabilities", [])
            caps_str = ", ".join(caps[:5]) if caps else "—"
            if len(caps) > 5:
                caps_str += f" (+{len(caps) - 5} more)"

            # Check if this company should show Salesforce badge
            company_name = company.get('name', 'Unknown')
            sf_badge = get_sf_badge_html() if is_in_salesforce(company_name) else ""
            st.markdown(f"""
            <div class="result-card">
                <strong>{company_name}</strong>{sf_badge}<br>
                <span style="color:#666">{company.get('industry', '')} {' | ' + company.get('location', '') if company.get('location') else ''}</span><br>
                <span style="color:#999; font-size:0.85rem">
                    {company.get('domain', '')}
                    {f" | Employees: {company.get('employee_count')}" if company.get('employee_count') else ''}
                </span><br>
                <span style="color:#666; font-size:0.85rem"><strong>Capabilities:</strong> {caps_str}</span>
            </div>
            """, unsafe_allow_html=True)

    st.session_state.selected_accounts = selected

    df = pd.DataFrame(results)
    csv = df.to_csv(index=False)
    st.download_button(
        "Download CSV",
        csv,
        "capability_search_results.csv",
        "text/csv",
    )


def render_company_results(results, segment):
    """Render company enrichment results."""
    for i, result in enumerate(results):
        company = result.get("company", result)
        contacts = result.get("contacts", [])

        col1, col2 = st.columns([0.05, 0.95])
        with col1:
            if st.checkbox("", key=f"select_company_{i}", value=True):
                account = {"name": company["name"], "domain": company.get("domain", "")}
                if account not in st.session_state.selected_accounts:
                    st.session_state.selected_accounts.append(account)

        with col2:
            # Check if this company should show Salesforce badge
            company_name = company['name']
            sf_badge = get_sf_badge_html() if is_in_salesforce(company_name) else ""
            st.markdown(f"<h3 style='margin:0; display:inline'>{company_name}</h3>{sf_badge}", unsafe_allow_html=True)

            col_a, col_b, col_c = st.columns(3)
            with col_a:
                st.metric("Employees", company.get("employee_count", "—"))
            with col_b:
                st.metric("Revenue", company.get("revenue_range") or company.get("revenue", "—"))
            with col_c:
                st.metric("Industry", company.get("industry", "—"))

            if company.get("description"):
                desc = company["description"]
                st.write(desc[:250] + "..." if len(desc) > 250 else desc)

            location_parts = [company.get("city"), company.get("state"), company.get("country")]
            location = ", ".join(filter(None, location_parts))
            if location:
                st.write(f"Location: {location}")

        if contacts:
            st.write("**Key Contacts**")
            contacts_df = pd.DataFrame(contacts)
            st.dataframe(contacts_df, use_container_width=True, hide_index=True)


def render_step_4():
    """Step 4: Claygent Intelligence"""
    selected = st.session_state.selected_accounts

    if not selected:
        st.warning("No accounts selected")
        if st.button("Back"):
            st.session_state.step = 3
            st.rerun()
        return

    st.write(f"Generating intelligence briefs for **{len(selected)} account(s)**")

    if not is_provider_configured("clay"):
        st.info("Clay API key not configured. Showing sample briefs for demo.")

    if not st.session_state.claygent_briefs:
        briefs = []
        progress = st.progress(0)
        for i, account in enumerate(selected):
            with st.spinner(f"Analyzing {account['name']}..."):
                try:
                    brief = generate_claygent_brief(
                        company_name=account["name"],
                        domain=account.get("domain"),
                    )
                    briefs.append(brief)
                except Exception as e:
                    briefs.append({
                        "status": "error",
                        "company_name": account["name"],
                        "error": str(e),
                    })
            progress.progress((i + 1) / len(selected))
        st.session_state.claygent_briefs = briefs

    for brief in st.session_state.claygent_briefs:
        with st.expander(f"{brief.get('company_name', 'Unknown')}", expanded=True):
            if brief.get("status") == "error":
                st.error(f"Failed: {brief.get('error')}")
                continue

            brief_data = brief.get("brief", {})

            st.write("**Summary**")
            st.write(brief_data.get("summary", "No summary available"))

            if brief_data.get("recent_news"):
                st.write("**Recent News**")
                for news in brief_data["recent_news"]:
                    st.write(f"• {news}")

            if brief_data.get("competitive_positioning"):
                st.write("**Competitive Positioning**")
                st.write(brief_data["competitive_positioning"])

            if brief_data.get("potential_pain_points"):
                st.write("**Potential Pain Points**")
                for point in brief_data["potential_pain_points"]:
                    st.write(f"• {point}")

            if brief_data.get("recommended_approach"):
                st.write("**Recommended Approach**")
                st.write(brief_data["recommended_approach"])

    st.write("")
    st.divider()

    col1, col2, col3 = st.columns([1, 1, 4])
    with col1:
        if st.button("Back"):
            st.session_state.claygent_briefs = []
            st.session_state.step = 3
            st.rerun()
    with col2:
        if st.button("Start Over"):
            reset_wizard()
            st.rerun()


if __name__ == "__main__":
    main()

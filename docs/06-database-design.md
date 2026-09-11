# 6. Database Design

## 6.1 Entity Relationship Summary

```
users (1) ─────────── (1) developer_profiles
developer_profiles (1) ─ (many) portfolio_items
developer_profiles (1) ─ (many) verification_history
developer_profiles (1) ─ (many) project_applications
developer_profiles (1) ─ (many) payments
developer_profiles (1) ─ (many) notifications
projects (1) ─────────── (many) project_applications
projects (1) ─────────── (many) project_attachments
projects (1) ─────────── (many) payments
projects (1) ─────────── (0..1) assigned developer via developer_profiles.id
users (1) ─────────── (many) audit_logs
```

---

## 6.2 Table: users

Stores login credentials and role for every account (Developer and Admin).

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| email | VARCHAR(255) | Unique, Not Null |
| password_hash | VARCHAR(255) | Not Null |
| role | ENUM('developer','admin') | Not Null, Default 'developer' |
| email_verified | BOOLEAN | Not Null, Default false |
| is_active | BOOLEAN | Not Null, Default true |
| created_at | TIMESTAMP | Not Null, Default now() |
| updated_at | TIMESTAMP | Not Null, Default now() |

---

## 6.3 Table: email_verification_tokens

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| user_id | UUID | Foreign Key -> users.id, Not Null |
| token | VARCHAR(255) | Unique, Not Null |
| expires_at | TIMESTAMP | Not Null |
| used_at | TIMESTAMP | Nullable |
| created_at | TIMESTAMP | Not Null, Default now() |

---

## 6.4 Table: password_reset_tokens

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| user_id | UUID | Foreign Key -> users.id, Not Null |
| token | VARCHAR(255) | Unique, Not Null |
| expires_at | TIMESTAMP | Not Null |
| used_at | TIMESTAMP | Nullable |
| created_at | TIMESTAMP | Not Null, Default now() |

---

## 6.5 Table: developer_profiles

One row per developer, linked one-to-one with users.

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| user_id | UUID | Foreign Key -> users.id, Unique, Not Null |
| full_name | VARCHAR(100) | Not Null |
| profile_picture_url | VARCHAR(500) | Nullable |
| country | VARCHAR(100) | Not Null |
| phone_number | VARCHAR(20) | Not Null |
| years_of_experience | INTEGER | Not Null, Default 0 |
| availability_status | ENUM('available','partially_available','not_available') | Not Null, Default 'available' |
| github_url | VARCHAR(300) | Nullable |
| linkedin_url | VARCHAR(300) | Nullable |
| resume_url | VARCHAR(500) | Nullable |
| resume_uploaded_at | TIMESTAMP | Nullable |
| verification_status | ENUM('not_submitted','pending','under_review','approved','rejected','changes_requested') | Not Null, Default 'not_submitted' |
| profile_completion_percent | INTEGER | Not Null, Default 0 |
| submitted_at | TIMESTAMP | Nullable |
| created_at | TIMESTAMP | Not Null, Default now() |
| updated_at | TIMESTAMP | Not Null, Default now() |

---

## 6.6 Table: developer_skills

Many-to-many join between developers and a normalized skill list.

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| developer_profile_id | UUID | Foreign Key -> developer_profiles.id, Not Null |
| skill_name | VARCHAR(100) | Not Null |

---

## 6.7 Table: developer_technologies

Preferred technologies per developer (separate from general skills to support project-technology matching).

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| developer_profile_id | UUID | Foreign Key -> developer_profiles.id, Not Null |
| technology_name | VARCHAR(100) | Not Null |

---

## 6.8 Table: portfolio_items

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| developer_profile_id | UUID | Foreign Key -> developer_profiles.id, Not Null |
| title | VARCHAR(150) | Not Null |
| description | TEXT | Not Null |
| project_link | VARCHAR(500) | Nullable |
| image_url | VARCHAR(500) | Nullable |
| created_at | TIMESTAMP | Not Null, Default now() |

---

## 6.9 Table: verification_history

Audit trail of every status change on a developer profile, with the Admin note attached.

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| developer_profile_id | UUID | Foreign Key -> developer_profiles.id, Not Null |
| changed_by_user_id | UUID | Foreign Key -> users.id, Not Null |
| previous_status | VARCHAR(30) | Not Null |
| new_status | VARCHAR(30) | Not Null |
| note | TEXT | Nullable |
| created_at | TIMESTAMP | Not Null, Default now() |

---

## 6.10 Table: projects

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| title | VARCHAR(150) | Not Null |
| description | TEXT | Not Null |
| budget_amount | DECIMAL(12,2) | Not Null |
| budget_currency | VARCHAR(10) | Not Null, Default 'USD' |
| timeline_deadline | DATE | Not Null |
| status | ENUM('open','assigned','in_progress','review','completed') | Not Null, Default 'open' |
| assigned_developer_id | UUID | Foreign Key -> developer_profiles.id, Nullable |
| created_by_user_id | UUID | Foreign Key -> users.id, Not Null |
| created_at | TIMESTAMP | Not Null, Default now() |
| updated_at | TIMESTAMP | Not Null, Default now() |

---

## 6.11 Table: project_technologies

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| project_id | UUID | Foreign Key -> projects.id, Not Null |
| technology_name | VARCHAR(100) | Not Null |

---

## 6.12 Table: project_attachments

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| project_id | UUID | Foreign Key -> projects.id, Not Null |
| file_url | VARCHAR(500) | Not Null |
| file_name | VARCHAR(255) | Not Null |
| uploaded_by_user_id | UUID | Foreign Key -> users.id, Not Null |
| created_at | TIMESTAMP | Not Null, Default now() |

---

## 6.13 Table: project_applications

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| project_id | UUID | Foreign Key -> projects.id, Not Null |
| developer_profile_id | UUID | Foreign Key -> developer_profiles.id, Not Null |
| note | VARCHAR(500) | Nullable |
| status | ENUM('pending','withdrawn','assigned','not_selected') | Not Null, Default 'pending' |
| applied_at | TIMESTAMP | Not Null, Default now() |

> **Unique constraint:** (project_id, developer_profile_id) — a developer may only have one active application per project.

---

## 6.14 Table: payments

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| developer_profile_id | UUID | Foreign Key -> developer_profiles.id, Not Null |
| project_id | UUID | Foreign Key -> projects.id, Not Null |
| amount | DECIMAL(12,2) | Not Null |
| currency | VARCHAR(10) | Not Null, Default 'USD' |
| status | ENUM('pending','paid') | Not Null, Default 'pending' |
| note | VARCHAR(500) | Nullable |
| recorded_by_user_id | UUID | Foreign Key -> users.id, Not Null |
| payment_date | DATE | Nullable |
| created_at | TIMESTAMP | Not Null, Default now() |

---

## 6.15 Table: notifications

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| developer_profile_id | UUID | Foreign Key -> developer_profiles.id, Nullable (null = broadcast) |
| type | ENUM('profile_approved','profile_rejected','changes_requested','new_project','project_assigned','payment_released','admin_message') | Not Null |
| message | VARCHAR(500) | Not Null |
| is_read | BOOLEAN | Not Null, Default false |
| created_at | TIMESTAMP | Not Null, Default now() |

---

## 6.16 Table: audit_logs

Records sensitive actions for security and traceability.

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary Key |
| user_id | UUID | Foreign Key -> users.id, Not Null |
| action | VARCHAR(100) | Not Null |
| entity_type | VARCHAR(50) | Not Null |
| entity_id | UUID | Nullable |
| ip_address | VARCHAR(45) | Nullable |
| created_at | TIMESTAMP | Not Null, Default now() |

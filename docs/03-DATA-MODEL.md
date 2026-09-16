VERSATECH OS — MODÈLE DE DONNÉES

PRINCIPE CENTRAL
Ne jamais dupliquer une entreprise entre Prospect et Client. Company représente l'organisation ; son lifecycle évolue.

ENTITÉS PRINCIPALES

User
- id
- name
- email
- passwordHash (scrypt, nullable jusqu'à initialisation du compte)
- role
- createdAt
- updatedAt

Company
- id
- name
- lifecycleStatus
- industry
- website
- phone
- email
- address
- city
- postalCode
- country
- source
- qualificationScore
- priority
- description
- createdAt
- updatedAt
Relations : contacts, interactions, opportunities, projects, documents, tasks.

Contact
- id
- companyId
- firstName
- lastName
- role
- phone
- email
- preferredChannel
- isPrimary
- createdAt
- updatedAt

Interaction
- id
- companyId
- contactId nullable
- opportunityId nullable
- type
- direction
- result
- subject
- notes
- occurredAt
- createdById
Types : CALL, EMAIL, MEETING, MESSAGE, NOTE, QUOTE, PAYMENT, OTHER.
Résultats appel : NO_ANSWER, GATEKEEPER, CALLBACK, INTERESTED, NOT_INTERESTED, MEETING_BOOKED, OTHER.

FollowUp
- id
- companyId
- opportunityId nullable
- contactId nullable
- title
- dueAt
- status
- priority
- completedAt
- sourceInteractionId nullable

Opportunity
- id
- companyId
- title
- stage
- estimatedValue
- probability
- source
- lostReason nullable
- expectedCloseDate nullable
- wonAt nullable
- lostAt nullable
- createdAt
- updatedAt

OpportunityStageHistory
- id
- opportunityId
- fromStage
- toStage
- changedAt
- changedById

Quote
- id
- companyId
- opportunityId
- projectId nullable
- reference
- amountExTax nullable
- amountTax nullable
- amountIncTax
- status
- sentAt
- acceptedAt
- externalUrl nullable
- createdAt

Project
- id
- companyId
- opportunityId nullable
- name
- status
- description
- startDate
- dueDate
- completedAt
- amount
- progress
- createdAt
- updatedAt

Task
- id
- title
- description
- status
- priority
- dueAt
- completedAt
- companyId nullable
- opportunityId nullable
- projectId nullable
- assignedToId

Milestone
- id
- projectId
- name
- dueAt
- status
- completedAt

Repository
- id
- projectId
- provider
- owner
- name
- url
- defaultBranch
- externalId nullable
- lastSyncedAt

CalendarEvent
- id
- title
- type
- startsAt
- endsAt
- allDay
- companyId nullable
- contactId nullable
- opportunityId nullable
- projectId nullable
- taskId nullable
- externalProvider nullable
- externalId nullable
- syncStatus nullable

Document
- id
- name
- type
- url
- companyId nullable
- opportunityId nullable
- projectId nullable
- createdAt

Payment
- id
- companyId
- projectId nullable
- quoteId nullable
- label
- amount
- status
- dueAt
- paidAt
- externalReference nullable

MaintenanceContract
- id
- companyId
- projectId nullable
- monthlyAmount
- status
- startDate
- endDate nullable
- description

ActivityLog
- id
- actorId nullable
- entityType
- entityId
- action
- metadata JSON
- createdAt

ENUMS INITIAUX
CompanyLifecycle: LEAD, CONTACTED, QUALIFIED, OPPORTUNITY, CLIENT, INACTIVE, LOST.
OpportunityStage: TO_QUALIFY, TO_CONTACT, CONTACTED, INTERESTED, MEETING, QUOTE, WON, LOST.
TaskStatus: TODO, IN_PROGRESS, DONE, CANCELED.
Priority: LOW, NORMAL, MEDIUM, HIGH, URGENT.
ProjectStatus: PLANNED, ACTIVE, WAITING_CLIENT, REVIEW, COMPLETED, ARCHIVED.
QuoteStatus: DRAFT, SENT, VIEWED(optional if reliably known), ACCEPTED, REJECTED, EXPIRED.
PaymentStatus: PENDING, PAID, OVERDUE, CANCELED.

INDEXATION À PRÉVOIR
Company(name, lifecycleStatus, industry, city)
Opportunity(stage, companyId)
Interaction(companyId, occurredAt)
FollowUp(dueAt, status)
Task(dueAt, status)
Project(status, dueDate)

RÈGLE
Les enums pourront évoluer pendant la conception, mais toute modification doit être répercutée dans les règles métier et l'UX.

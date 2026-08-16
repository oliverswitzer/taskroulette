Feature: Brain dump parsing
  As an ADHD user who is overwhelmed
  I want to dump everything swirling in my head as free text or a photo
  So that an AI structures it into a concrete task list without me organizing it myself

  Background:
    Given I am on the DUMP screen

  Rule: The parse action requires either text or a photo

    Scenario: Parse button is disabled with no input
      Then the "Parse my tasks" button is disabled

    Scenario: Parse button enables once text is entered
      When I type "call dentist, pay the electricity bill, reply to sarah" into the brain dump textarea
      Then the "Parse my tasks" button is enabled

    Scenario: Parse button enables with only a photo attached
      Given I have not entered any text
      When I attach a photo of a handwritten task list
      Then the "Parse my tasks" button is enabled

  Rule: Text-only dumps are parsed by Claude into a task list

    Scenario: A typed brain dump is parsed into multiple tasks
      When I type "call dentist, pay the electricity bill, reply to sarah about dinner plans" into the brain dump textarea
      And I tap "Parse my tasks"
      Then I am taken to the LIST_EDIT screen
      And at least 2 tasks are shown in the list

    Scenario: Parsing an empty dump does not proceed
      Given the brain dump textarea is empty
      Then I cannot submit the dump
      And I remain on the DUMP screen

    Scenario: Claude finds nothing in the dump
      When I type "                " into the brain dump textarea
      And I tap "Parse my tasks"
      And Claude returns zero tasks for my dump
      Then I see the error message "No tasks found in your input. Try adding more detail or a clearer photo."
      And I remain on the DUMP screen

  Rule: Photos can be parsed via Claude vision, first attach shows onboarding once

    Scenario: First-time photo attach shows an onboarding dialog
      Given I have never attached a photo before
      When I tap the attach photo button
      Then an onboarding dialog appears
      And the dialog mentions "Parse a photo too"
      And the dialog mentions "Handwritten lists"

    Scenario: Confirming the onboarding dialog opens the file picker
      Given the onboarding dialog is visible
      When I tap "Got it"
      Then the native file picker opens
      And selecting a photo shows a photo preview thumbnail

    Scenario: Second photo attach skips the onboarding dialog
      Given I have already dismissed the photo onboarding dialog once
      When I tap the attach photo button
      Then the native file picker opens directly
      And no onboarding dialog appears

    Scenario: Removing an attached photo clears it
      Given I have attached a photo
      When I tap the remove photo button
      Then the photo preview disappears
      And the "Parse my tasks" button is disabled if no text was typed

    Scenario: A photo-only dump extracts tasks via Claude vision
      Given I have attached a photo of a handwritten task list containing "Schedule dentist appointment", "Pay electricity bill", and "Reply to sarah about dinner"
      When I tap "Parse my tasks"
      Then I am taken to the LIST_EDIT screen
      And at least 1 task is shown in the list
      And at least one extracted task references the photo's content

    Scenario: Text and photo are merged into one task list
      Given I have typed "buy new headphones" into the brain dump textarea
      And I have attached a photo of a handwritten task list containing "Schedule dentist appointment", "Pay electricity bill", and "Reply to sarah about dinner"
      When I tap "Parse my tasks"
      Then I am taken to the LIST_EDIT screen
      And at least 2 tasks are shown in the list
      And one of the tasks references "headphones"
      And at least one other task references the photo's content

  Rule: Session limits gate excessive use

    Scenario: A user under the daily session limit can parse freely
      Given I have used fewer than 3 sessions today
      When I type "clean the kitchen" into the brain dump textarea
      And I tap "Parse my tasks"
      Then the dump is parsed normally

    Scenario: A user who has hit the daily session limit and has no email on file is shown the email gate
      Given I have used 3 sessions today
      And I have not submitted my email
      When I type "clean the kitchen" into the brain dump textarea
      And I tap "Parse my tasks"
      Then the email gate modal appears
      And I remain on the DUMP screen until I submit an email or dismiss the modal

    Scenario: A user who has hit the daily session limit but has an email on file is told to come back tomorrow
      Given I have used 3 sessions today
      And I have already submitted my email
      When I type "clean the kitchen" into the brain dump textarea
      And I tap "Parse my tasks"
      Then I see the message "You've hit your limit of 3 sessions today. Come back tomorrow 💪"
      And I remain on the DUMP screen

    Scenario: Submitting an email in the gate modal unlocks the session and lets the user continue
      Given the email gate modal is visible
      When I enter a valid email address
      And I submit the email form
      Then I see a confirmation that says "You're in!"
      And the email gate modal closes after a short delay
      And my email is remembered so the gate does not reappear this session

    Scenario: Submitting an invalid email in the gate modal shows a validation error
      Given the email gate modal is visible
      When I enter "not-an-email"
      And I submit the email form
      Then I see the error message "Please enter a valid email address"
      And the email gate modal remains open

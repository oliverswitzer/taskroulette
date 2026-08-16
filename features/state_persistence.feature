Feature: State persistence and navigation
  As a user who might reload the page or navigate away mid-session
  I want my progress preserved and browser back-button behavior to feel natural
  So that I never lose my task list or land on a broken screen

  Scenario: App state survives a page reload
    Given I am on the LIST_EDIT screen with 3 tasks
    When I reload the page
    Then I am still on the LIST_EDIT screen
    And the same 3 tasks are still present

  Scenario: A transient WHEEL_SPINNING state is not restored on cold boot
    Given the persisted app state is WHEEL_SPINNING
    When the app boots fresh
    Then I am shown the WHEEL_IDLE screen instead
    And the wheel is not spinning

  Scenario: A transient TASK_CARD state is not restored on cold boot
    Given the persisted app state is TASK_CARD
    When the app boots fresh
    Then I am shown the WHEEL_IDLE screen instead

  Scenario: A transient PARSING state is not restored on cold boot
    Given the persisted app state is PARSING
    When the app boots fresh
    Then I am shown the DUMP screen instead

  Scenario: A restorable TASK_CARD state is honored if the selected task still exists
    Given the persisted app state is TASK_CARD
    And the persisted selected task still exists and is not completed
    When the app boots fresh
    Then I am shown the TASK_CARD screen for that task

  Scenario: Starting fresh after ALL_DONE resets all persisted state
    Given I am on the ALL_DONE screen
    When I tap "Start fresh"
    And I reload the page
    Then I am on the DUMP screen
    And there are no tasks and no completed count

  Scenario: Pressing the browser back button from the wheel returns to list edit
    Given I am on the WHEEL_IDLE screen
    When I press the browser back button
    Then I am returned to the LIST_EDIT screen
    And the edit modal is closed if it was open

  Scenario: Pressing the browser back button from list edit prompts a confirmation
    Given I am on the LIST_EDIT screen
    When I press the browser back button
    Then a confirmation dialog appears asking if I want to leave

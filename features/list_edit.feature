Feature: Editing the parsed task list
  As a user reviewing my parsed brain dump
  I want to add, edit, and remove tasks before spinning the wheel
  So that the wheel only ever picks from tasks I actually want to do

  Background:
    Given I am on the LIST_EDIT screen with a parsed task list

  Scenario: Adding a task manually
    When I add a new task with the text "Water the plants"
    Then "Water the plants" appears in the task list

  Scenario: Editing an existing task's text
    Given a task with the text "Call dentist" is in the list
    When I edit that task's text to "Call dentist about braces"
    Then the task list shows "Call dentist about braces"
    And it no longer shows "Call dentist"

  Scenario: Deleting a task
    Given a task with the text "Buy groceries" is in the list
    When I delete that task
    Then "Buy groceries" no longer appears in the task list

  Scenario: The task list is capped at 15 tasks
    Given the task list already has 15 tasks
    Then the "add task" control is disabled
    And I cannot add another task

  Scenario: Removing a task under the cap re-enables adding
    Given the task list has 15 tasks
    When I delete one task
    Then the "add task" control is enabled again

  Scenario: Proceeding to the wheel with tasks
    Given the task list has at least 1 task
    When I tap "Let's spin"
    Then I am taken to the WHEEL_IDLE screen with all my tasks loaded onto the wheel

  Scenario: A newly added task appears on the wheel after proceeding
    Given the task list has 2 tasks
    When I add a new task with the text "Fold laundry"
    And I tap "Let's spin"
    Then the wheel has 3 slices
    And one slice is "Fold laundry"
